#include "httpServer.h"
#include "json.h"
#include "cyclicStore.h"
#include "rapidjson/prettywriter.h"
#include "wsServer.h"

#include <map>
#include <vector>
#include <mutex>
#include <fstream>
#include <sys/stat.h>
#include <thread>         // std::thread
#include <algorithm>        // std::count

using namespace std;

/* [ { 'type': STRING, 
 *     'data': {'host': STRING,
 *              'label': STRING,
 *              'key': STRING,
 *              'val': STRING
 *             }
 *   },
 *   { etc..}
 * ]
 */

string data_path = "";

/* Any threads should exit if run==0. */
int run = 1;

/* Gets called whenever POST data arrives over http. */
int CallbackPost(std::string* p_buffer, map<string, string>* p_arguments){
    Document document;
    document.Parse(p_buffer->c_str());
    if(JSONtoInternal(&document)){
        (*p_arguments)["error"] = "yes";
        return 1;
    }
    return 0;
}

/* Return JSON formated text in response to GET. */
int CallbackGetData(std::string* p_buffer, map<string, string>* p_arguments){
    Document array;
    InternalToJSON(&array, p_arguments);

    if(p_arguments->count("pretty")){
        StringBuffer buffer;
        PrettyWriter<StringBuffer> writer(buffer);
        array.Accept(writer);
        *p_buffer = buffer.GetString();
    } else {
        StringBuffer buffer;
        Writer<StringBuffer> writer(buffer);
        array.Accept(writer);
        *p_buffer = buffer.GetString();
    }
    return 0;
} 

/* Save configuration to disk cache. */
int CallbackSave(std::string* p_buffer, map<string, string>* p_arguments){
    FileUtils file;
    if(file.writable(data_path, "configuration") != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    // Path exists and is writable.
    string buffer;
    map<string, string> arguments_to_save;
    arguments_to_save["type"] = "configuration";
    arguments_to_save["pretty"] = "1";
    CallbackGetData(&buffer, &arguments_to_save);

    file.write(data_path, "test", buffer);

    *p_buffer = "ok";
    return 0;
}

/* Read saved configuration to disk cache. */
int CallbackRead(std::string* p_buffer, map<string, string>* p_arguments){
    FileUtils file_util;
    if(file_util.writable(data_path, "configuration") != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    string line, buffer;
    do{
        file_util.read_line(data_path, "test", &line);
        buffer += line + "\n";
    }while(line != "");

    map<string, string> unused_map;
    if(CallbackPost(&buffer, &unused_map)){
        *p_buffer = "Error reading cached config.";
        return 1;
    }
    *p_buffer = "ok";

    return 0;
}

/* How many minutes have passed since the start of the week.
 * Sunday is the first day of the week. */
int minutesIntoWeek(void){
    time_t rawtime;
    struct tm * timeinfo;
    char day[2];
    char hour[3];
    char minute[3];

    time(&rawtime);
    timeinfo = localtime(&rawtime);

    strftime(day, 2, "%w", timeinfo);
    strftime(hour, 3, "%H", timeinfo);
    strftime(minute, 3, "%M", timeinfo);
    
    int ret_val = (stoi(day) * 24 * 60) + (stoi(hour) * 60) + stoi(minute);

    return ret_val;
}


void houseKeeping(void){
    int counter;
    map<string, string> arguments;
    Document array;

    int mins;

    while(run){
        counter = 0;
        // Sleep for 30 seconds.
        while(run && ++counter < 6){
            sleep(5);
        }
        // Save any user input from the last 5 minutes.
        arguments.clear();
        arguments["type"] = "userInput";
        arguments["age"] = "300";  // 5 minutes.
        InternalToJSON(&array, &arguments);
        //cout << array.write_formatted() << endl;
        mins = minutesIntoWeek();
        double val;
        int most_recent = 300;  // Matches 5 minutes for "age" above.
        // Loop through all nodes received.
        cout << endl;
        for(SizeType i = 0; i < array.Size(); i++){
            // We are only interested if this is a more recent node.
            Value::ConstMemberIterator itr_age = array[i].FindMember("age");
            if(itr_age != array[i].MemberEnd()){
                if(itr_age->value.GetInt() < most_recent){
                    most_recent = itr_age->value.GetInt();

                    Value::ConstMemberIterator itr_data = array[i].FindMember("data");
                    if(itr_data != array[i].MemberEnd()){
                        Value::ConstMemberIterator itr_val = itr_data->value.FindMember("val");
                        if(itr_val != itr_data->value.MemberEnd()){
                            val = stof(itr_val->value.GetString());
                            Cyclic::lookup("temp_setting_1_week")->store(mins, val);
                            //cout << "Stored userInput. age: " << itr_age->value.GetInt() << " val: " << val << endl;
                        }
                    }
                }
            }
        }

        // Get all active devices on network in the last 5 minutes.
        // We only need save the key as it is the MAC address.
        arguments.clear();
        arguments["type"] = "sensors";
        arguments["age"] = "900";  // 15 minutes.
        arguments["data"] = "{\"label\":\"net_clients\"}";
        InternalToJSON(&array, &arguments);

        vector<string> active_hosts;
        for(SizeType i = 0; i < array.Size(); i++){
            Value::ConstMemberIterator itr_data = array[i].FindMember("data");
            if(itr_data != array[i].MemberEnd()){
                Value::ConstMemberIterator itr_key = itr_data->value.FindMember("key");
                if(itr_key != itr_data->value.MemberEnd()){
                    string key = itr_key->value.GetString();
                    active_hosts.push_back(key);
                }
            }
        }

        // Now cross refernce those with devices that have people assigned to them.
        // TODO make a setting that allows us to opt a paticular device in/out of this count.
        arguments.clear();
        arguments["type"] = "configuration";
        arguments["data"] = "{\"label\":\"userId\"}";
        InternalToJSON(&array, &arguments);

        vector<string> unique_users;
        for(SizeType i = 0; i < array.Size(); i++){
            Value::ConstMemberIterator itr_data = array[i].FindMember("data");
            if(itr_data != array[i].MemberEnd()){
                Value::ConstMemberIterator itr_key = itr_data->value.FindMember("key");
                Value::ConstMemberIterator itr_val = itr_data->value.FindMember("val");
                if(itr_key != itr_data->value.MemberEnd() && itr_val != itr_data->value.MemberEnd()){
                    string key = itr_key->value.GetString();
                    string userId = itr_val->value.GetString();
                    //cout << "MAC: " << key << "\tuserId: " << userId << endl;

                    // Check the key is in both tables and userId has only been couted once.
                    if(userId != "none" && count(active_hosts.begin(), active_hosts.end(), key) && 
                            count(unique_users.begin(), unique_users.end(), userId) == 0){
                        unique_users.push_back(userId);
                    }
                }
            }
        }
        cout << "Number of active hosts: " << active_hosts.size();
        cout << "\tNumber of unique users: " << unique_users.size() << endl;

        Cyclic::lookup("whos_home_1_week")->store(mins, unique_users.size());
    }

    cout << "Closing houseKeeping_thread." << endl;
}

int main(int argc, char **argv){
    if (argc != 2 && argc != 3) {
        printf("%s PORT [DATA_PATH]\n", argv[0]);
        return 1;
    }

    if (argc == 3){
        data_path = argv[2];
    }
    string str_data_path = data_path;

    Cyclic store_whos_home_1_week("whos_home_1_week", 10, MINS_IN_WEEK, 100, 0, str_data_path);
    Cyclic store_temp_setting_1_week("temp_setting_1_week", 2, MINS_IN_WEEK, 10, 20, str_data_path);

    Cyclic::lookup("whos_home_1_week")->restore_from_disk();

    cout << "allCyclic.size: " << Cyclic::allCyclic.size() << endl;

    // Read config from disk.
    string unused_buffer;
    map<string, string> unused_arguments;
    CallbackRead(&unused_buffer, &unused_arguments);

    thread houseKeeping_thread(houseKeeping);

    http_server daemon(atoi(argv[1]));
    daemon.register_path("/save", "GET", &CallbackSave);
    daemon.register_path("/read", "GET", &CallbackRead);
    daemon.register_path("/data", "GET", &CallbackGetData);
    daemon.register_path("/put", "POST", &CallbackPost);
    daemon.register_path("/whoin", "GET", &store_whos_home_1_week);

    ws_server ws_daemon(atoi(argv[1]) +1);
    ws_daemon.register_path("/data", "GET", &CallbackGetData);
    ws_daemon.register_path("/whoin", "GET", &store_whos_home_1_week);


    (void)getchar();

    // Tell threads to quit and wait for that to happen.    
    run = 0;
    houseKeeping_thread.join();

    return 0;
}

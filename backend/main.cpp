#include "httpServer.h"
#include "libjson/libjson.h"
#include "json.h"
#include "cyclicStore.h"
#include "rapidjson/prettywriter.h"

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


mutex file_mutex;
Cyclic store_whos_home_1_week("whos_home_1_week", 10, MINS_IN_WEEK, 100, 0);
Cyclic store_temp_setting_1_week("temp_setting_1_week", 2, MINS_IN_WEEK, 10, 20);

/* Any threads should exit if run==0. */
int run = 1;

int CallbackPost(std::string* p_buffer, map<string, string>* p_arguments){
    Document document;
    document.Parse(p_buffer->c_str());
    if(JSONtoInternal(&document)){
        (*p_arguments)["error"] = "yes";
    }
}

int CallbackGetData(std::string* p_buffer, map<string, string>* p_arguments){
    Document test_array;
    InternalToJSON(&test_array, p_arguments);

    if(p_arguments->count("pretty")){
        StringBuffer buffer;
        PrettyWriter<StringBuffer> writer(buffer);
        test_array.Accept(writer);
        *p_buffer = buffer.GetString();
    } else {
        StringBuffer buffer;
        Writer<StringBuffer> writer(buffer);
        test_array.Accept(writer);
        *p_buffer = buffer.GetString();
    }
} 

int TestPath(const string path, const string filename){
    static int path_exists = 0;

    if(path_exists == 0){
        // First time here. Check for directory.
        struct stat sb;
        if (stat(path.c_str(), &sb) == -1) {
            path_exists = -1;
            return -1;
        }
        if((sb.st_mode & S_IFMT) != S_IFDIR){
            path_exists = -1;
            return -1;
        }

        // TODO test ability to read file.

        // So far, so good.
        path_exists = 1;
    }
    return path_exists;
}

int CallbackSave(std::string* p_buffer, map<string, string>* p_arguments){
    if(TestPath(data_path, "configuration") != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 0;
    }

    // Path exists and is writable.
    string buffer;
    map<string, string> arguments_to_save;
    arguments_to_save["type"] = "configuration";
    arguments_to_save["pretty"] = "1";
    CallbackGetData(&buffer, &arguments_to_save);


    file_mutex.lock();

    string full_path_working = data_path + "/configuration.cfg.tmp";
    string full_path_done = data_path + "/configuration.cfg";

    ofstream out(full_path_working.c_str());
    out << buffer << endl;;
    out.close();

    rename(full_path_working.c_str(), full_path_done.c_str());

    file_mutex.unlock();

    *p_buffer = "ok";
}

int CallbackRead(std::string* p_buffer, map<string, string>* p_arguments){
    if(TestPath(data_path, "configuration") != 1){
        *p_buffer = "Cannot read from " + data_path + ".";
        return 0;
    }

    file_mutex.lock();

    string full_path = data_path + "/configuration.cfg";
    ifstream file(full_path.c_str());
    string buffer((istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();
    
    cout << buffer << endl;

    file_mutex.unlock();

    map<string, string> unused_map;
    CallbackPost(&buffer, &unused_map);

    *p_buffer = "ok";
}


int CallbackDisplayWhosIn(std::string* p_buffer, map<string, string>* p_arguments){
    JSONNode array(JSON_NODE);

    int step_size = 1;
    if(p_arguments->count("step_size")){
        step_size = stoi(p_arguments->find("step_size")->second);
    }
    store_whos_home_1_week.to_JSON(&array);
    *p_buffer = array.write_formatted();
}

int minutesIntoWeek(void){
    time_t rawtime;
    struct tm * timeinfo;
    char week[2];
    char hour[3];
    char minute[3];

    time(&rawtime);
    timeinfo = localtime(&rawtime);

    strftime(week, 2, "%w", timeinfo);
    strftime(hour, 3, "%H", timeinfo);
    strftime(minute, 3, "%M", timeinfo);
    
    int ret_val = (stoi(week) * 24 * 60) + (stoi(hour) * 60) + stoi(minute);

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
                            store_temp_setting_1_week.store(mins, val);
                            cout << "Stored userInput. age: " << itr_age->value.GetInt() << " val: " << val << endl;
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
                    cout << "MAC: " << key << "\tuserId: " << userId << endl;
                    // Check the key is in both tables and userId has only been couted once.
                    if(userId != "none" && count(active_hosts.begin(), active_hosts.end(), key) && 
                            count(unique_users.begin(), unique_users.end(), userId) == 0){
                        unique_users.push_back(userId);
                    }
                }
            }
        }
        cout << "Number of active hosts: " << active_hosts.size() << endl;
        cout << "Number of unique users: " << unique_users.size() << endl;

        store_whos_home_1_week.store(mins, unique_users.size());
    }

    cout << "Closing houseKeeping_thread." << endl;
}

int main(int argc, char **argv){
    if (argc != 2 && argc != 3) {
        printf("%s PORT [DATA_PATH]\n", argv[0]);
        return 1;
    }

    http_server daemon(atoi(argv[1]));

    if (argc == 3){
        data_path = argv[2];
    }

    string str_data_path = data_path;
    store_temp_setting_1_week.register_path(str_data_path);
    store_whos_home_1_week.register_path(str_data_path);

    store_whos_home_1_week.restore_from_disk();

    // Read config from disk.
    string unused_buffer;
    map<string, string> unused_arguments;
    CallbackRead(&unused_buffer, &unused_arguments);

    thread houseKeeping_thread(houseKeeping);

    daemon.register_path("/save", "GET", &CallbackSave);
    daemon.register_path("/read", "GET", &CallbackRead);
    daemon.register_path("/data", "GET", &CallbackGetData);
    daemon.register_path("/1.0/event/put", "POST", &CallbackPost);
    daemon.register_path("/whoin", "GET", &CallbackDisplayWhosIn);

    (void)getchar();
    
    run = 0;
    houseKeeping_thread.join();

    return 0;
}

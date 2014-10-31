#include "httpServer.h"
#include "libjson/libjson.h"
#include "json.h"
#include "cyclicStore.h"

#include <map>
#include <vector>
#include <list>
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

struct data_node{
    string type;
    map<string, string> data;
    time_t time;

    bool operator==(const data_node& rhs) const{
        if(type != rhs.type){
            return 0;
        }
        if(data.find("key")->second.compare(rhs.data.find("key")->second) == 0 && data.find("label")->second.compare(rhs.data.find("label")->second) == 0){
            return 1;
        }
        return 0;
    }
};

list<struct data_node> data_nodes;
mutex data_nodes_mutex;

mutex file_mutex;

Cyclic store_whos_home_1_week("whos_home_1_week", 10, MINS_IN_WEEK, 100, 0);
Cyclic store_temp_setting_1_week("temp_setting_1_week", 2, MINS_IN_WEEK, 10, 20);

int run = 1;

int SavePostData(string type, map<string, string> data){
    struct data_node new_node;
    new_node.type = type;
    new_node.data = data;
    time(&(new_node.time));

    data_nodes_mutex.lock();
    for(list<struct data_node>::iterator it = data_nodes.begin() ; it != data_nodes.end(); ++it){
        if(*it == new_node){
            data_nodes.remove(*it);
            break;
        }
    }
    data_nodes.push_back(new_node);
    data_nodes_mutex.unlock();
    return 0;
}

int CallbackPost(std::string* p_buffer, map<string, string>* p_arguments){
    ParseJSON json(p_buffer->c_str(), &SavePostData);
    if(json.error){
        (*p_arguments)["error"] = "yes";
    }
}

int GetData(JSONNode* p_array, map<string, string>* p_arguments){

    time_t time_now;
    time(&time_now);

    string arg_type = "";
    JSONNode arg_data;
    int arg_age = 0;
    for(map<string, string>::iterator it_arguments=p_arguments->begin(); it_arguments!=p_arguments->end(); ++it_arguments){
        if(it_arguments->first == "type"){
            arg_type = it_arguments->second;
        }
        if(it_arguments->first == "data"){
            arg_data = libjson::parse(it_arguments->second);
        }
        if(it_arguments->first == "age"){
            arg_age = stoi(it_arguments->second);
        }
    }

    data_nodes_mutex.lock();
    for(list<struct data_node>::iterator it = data_nodes.begin() ; it != data_nodes.end(); ++it){
        if((arg_type.compare(it->type) == 0 || arg_type.compare("") == 0) && (arg_age == 0 || arg_age >= time_now - it->time)){

            //cout << it->type << endl;

            JSONNode node(JSON_NODE);
            node.push_back(JSONNode("type", it->type));
            node.push_back(JSONNode("age", time_now - it->time));
            JSONNode data(JSON_NODE);
            data.set_name("data");

            int match_args = 1;
            for(map<string, string>::iterator it_data = it->data.begin() ; it_data != it->data.end(); ++it_data){
                for(JSONNode::const_iterator it_arguments=arg_data.begin(); it_arguments!=arg_data.end(); ++it_arguments){
                    if(it_arguments->type() != JSON_NULL){
                        if(it_arguments->name() == it_data->first){
                            if(it_arguments->as_string().compare(it_data->second) != 0){
                                match_args = 0;
                            }
                        }
                    }
                }
                if(match_args == 0){
                    break;
                }
                //cout << it_data->first << "\t" << it_data->second << endl;
                data.push_back(JSONNode(it_data->first, it_data->second));
            }
            if(match_args){
                node.push_back(data);
                p_array->push_back(node);
            }
        }
    }
    data_nodes_mutex.unlock();
}

int CallbackGetData(std::string* p_buffer, map<string, string>* p_arguments){
    JSONNode array(JSON_ARRAY);
    GetData(&array, p_arguments);

    *p_buffer = "";
    if(p_arguments->count("pretty")){
        p_buffer->append(array.write_formatted());
    } else {
        p_buffer->append(array.write());
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

void DisplayCyclicBuffer(JSONNode* p_array, Cyclic* cyclic, int step_size){
    for(int time = 0; time < cyclic->mins_in_period; time += step_size){
        p_array->push_back(JSONNode(to_string(time), cyclic->read(time)));
    }
}

int CallbackDisplayWhosIn(std::string* p_buffer, map<string, string>* p_arguments){
    JSONNode array(JSON_NODE);

    int step_size = 1;
    if(p_arguments->count("step_size")){
        step_size = stoi(p_arguments->find("step_size")->second);
    }
    DisplayCyclicBuffer(&array, &store_whos_home_1_week, step_size);
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
    JSONNode array(JSON_ARRAY);

    int mins;

    while(run){
        counter = 0;
        // Sleep for 30 seconds.
        while(run && ++counter < 6){
            sleep(5);
        }

        // Save any user input from the last 5 minutes.
        array.clear();
        arguments["type"] = "userInput";
        arguments["age"] = "300";  // 5 minutes.
        GetData(&array, &arguments);
        //cout << array.write_formatted() << endl;

        mins = minutesIntoWeek();
        float val;
        // Only save if we see data so 
        if(array.begin() != array.end() && array.begin()->find("data") != array.end() && array.begin()->find("data")->find("val") != array.end()){
            val = array.begin()->find("data")->find("val")->as_float();
            cout << mins << "\t" << val << endl;
            store_temp_setting_1_week.store(mins, val);
        } else {
            // TODO flush store_temp_setting_1_week
        }


        // Get all active devices on network in the last 5 minutes.
        array.clear();
        arguments.clear();
        arguments["type"] = "sensors";
        arguments["age"] = "900";  // 15 minutes.
        arguments["data"] = "{\"label\":\"net_clients\"}";
        GetData(&array, &arguments);

        vector<string> active_hosts;
        
        for(JSONNode::const_iterator it=array.begin(); it!=array.end(); ++it){
            if(it->find("data") != it->end() && it->find("data")->find("key") != array.end()){
                active_hosts.push_back(it->find("data")->find("key")->as_string());
            }
        }

        // Now cross refernce those with devices that have people assigned to them.
        // TODO make a setting that allows us to opt a paticular device in/out of this count.
        array.clear();
        arguments.clear();
        arguments["type"] = "configuration";
        arguments["data"] = "{\"label\":\"userId\"}";
        GetData(&array, &arguments);

        vector<string> unique_users;

        for(JSONNode::const_iterator it=array.begin(); it!=array.end(); ++it){
            if(it->find("data") != it->end() && it->find("data")->find("key") != array.end() && 
                    it->find("data")->find("val") != array.end() && it->find("data")->find("val")->as_string() != "none"){
                string key = it->find("data")->find("key")->as_string();
                string userId = it->find("data")->find("val")->as_string();
                if(count(active_hosts.begin(), active_hosts.end(), key)){
                    cout << key << endl;
                    if(count(unique_users.begin(), unique_users.end(), userId) == 0){
                        unique_users.push_back(userId);
                        cout << "  " << userId << endl;
                    }
                }
            }
        }
        store_whos_home_1_week.store(mins, unique_users.size());

        cout << active_hosts.size() << "\t" << unique_users.size() << endl;
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

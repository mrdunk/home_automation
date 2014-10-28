#include "httpServer.h"
#include "libjson/libjson.h"
#include "json.h"

//#include "leveldb/db.h"
#include <map>
#include <list>
#include <mutex>
#include <fstream>
#include <sys/stat.h>

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

int SavePostData(string type, map<string, string> data){
    struct data_node new_node;
    new_node.type = type;
    new_node.data = data;

    data_nodes_mutex.lock();
    for (list<struct data_node>::iterator it = data_nodes.begin() ; it != data_nodes.end(); ++it){
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
}

int CallbackGetData(std::string* p_buffer, map<string, string>* p_arguments){
    *p_buffer = "";
    JSONNode array(JSON_ARRAY);

    int prettyprint = 0;
    string arg_type = "";
    JSONNode arg_data;
    for(map<string, string>::iterator it_arguments=p_arguments->begin(); it_arguments!=p_arguments->end(); ++it_arguments){
        if(it_arguments->first == "pretty"){
            prettyprint = 1;
        }
        if(it_arguments->first == "type"){
            arg_type = it_arguments->second;
        }
        if(it_arguments->first == "data"){
            arg_data = libjson::parse(it_arguments->second);
        }
    }

    data_nodes_mutex.lock();
    for(list<struct data_node>::iterator it = data_nodes.begin() ; it != data_nodes.end(); ++it){
        if(arg_type.compare(it->type) == 0 || arg_type.compare("") == 0){

            //cout << it->type << endl;

            JSONNode node(JSON_NODE);
            node.push_back(JSONNode("type", it->type));
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
                array.push_back(node);
            }
        }
    }
    data_nodes_mutex.unlock();

    if(prettyprint){
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

    string full_path = data_path + "/configuration.cfg.tmp";
    ofstream out(full_path.c_str());
    out << buffer << endl;;
    out.close();

    file_mutex.unlock();

    *p_buffer = "ok";
}

int CallbackRead(std::string* p_buffer, map<string, string>* p_arguments){
    if(TestPath(data_path, "configuration") != 1){
        *p_buffer = "Cannot read from " + data_path + ".";
        return 0;
    }

    file_mutex.lock();

    string full_path = data_path + "/configuration.cfg.tmp";
    ifstream file(full_path.c_str());
    string buffer((istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();
    
    cout << buffer << endl;

    file_mutex.unlock();

    map<string, string> unused_map;
    CallbackPost(&buffer, &unused_map);

    *p_buffer = "ok";
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

    daemon.register_path("/save", "GET", &CallbackSave);
    daemon.register_path("/read", "GET", &CallbackRead);
    daemon.register_path("/data", "GET", &CallbackGetData);
    daemon.register_path("/1.0/event/put", "POST", &CallbackPost);

    (void)getchar();
    return 0;
}

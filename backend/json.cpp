
#include "json.h"

using namespace rapidjson;

void s_data_nodes::push(struct data_node* node){
    lock_container.lock();
    for(list<struct data_node>::iterator it = container.begin() ; it != container.end(); ++it){
        if(*it == *node){
            container.remove(*it);
            break;
        }
    }
    container.push_back(*node);
    lock_container.unlock();
}

vector<struct data_node> s_data_nodes::lookup(map<string,string>* p_arguments){
    vector<struct data_node> return_list;
    lookup(p_arguments, &return_list);
    return return_list;
}

void s_data_nodes::lookup(map<string,string>* p_arguments, vector<struct data_node>* p_return_values){
    time_t time_now;
    time(&time_now);

    string arg_type = "";
    int arg_age = 0;
    Document arg_data;
    for(map<string, string>::iterator it_arguments=p_arguments->begin(); it_arguments!=p_arguments->end(); ++it_arguments){
        if(it_arguments->first == "type"){
            arg_type = it_arguments->second;
        }
        if(it_arguments->first == "data"){
            arg_data.Parse(it_arguments->second.c_str()); 
        }
        if(it_arguments->first == "age"){
            // Sanitise string before converting to intiger.
            // We only need to clear peceeding shite because stoi() can handle trailing.
            string str = it_arguments->second;
            std::size_t found = str.find_first_of("0123456789.");
            if((found!=std::string::npos)){
                str.erase(0, found);
            }
            arg_age = stoi(str);
        }
    }

    lock_container.lock();
    for(list<struct data_node>::iterator it = container.begin() ; it != container.end(); ++it){
        struct data_node potential_node;
        if((arg_type.compare(it->type) == 0 || arg_type.compare("") == 0) && (arg_age == 0 || arg_age >= time_now - it->time)){
            // "type" and "age" match. So far, so good.
            int match_args = 1;
            for(map<string, string>::iterator it_data = it->data.begin() ; it_data != it->data.end(); ++it_data){
                if(arg_data.IsObject()){
                    Value::ConstMemberIterator itr = arg_data.FindMember(it_data->first.c_str());
                    if(itr != arg_data.MemberEnd()){
                        // Matching field.
                        if(it_data->second.compare(itr->value.GetString()) != 0){
                            match_args = 0;
                        }
                    }
                }

                if(match_args == 0){
                    break;
                }
                potential_node.data[it_data->first] = it_data->second;
            }
            if(match_args){
                // Match found.
                potential_node.type = it->type;
                potential_node.time = it->time;
                p_return_values->push_back(potential_node);
            }

        }
    }
    lock_container.unlock();
}

struct s_data_nodes data_nodes;

int JSONtoInternal(Document* p_JSON_input){
    Document* p_JSON_parent_array;
    Document JSON_parent_array;  // A little wasteful as we only use it if p_JSON_input->IsObject() but it's cleaner than using "new".

    if(p_JSON_input->IsObject()){
        // We have a single object rather than the expected array.
        // Let's presume it is a valid object and put it in an array.
        p_JSON_parent_array = &JSON_parent_array;
        p_JSON_parent_array->SetArray();
        p_JSON_parent_array->PushBack(*p_JSON_input, p_JSON_parent_array->GetAllocator());
    } else if(p_JSON_input->IsArray()){
        // Already in correct format.
        p_JSON_parent_array = p_JSON_input;
    } else {
        cout << "Invalid JSON" << endl;
        return 1;
    }

    for(SizeType node_num = 0; node_num < p_JSON_parent_array->Size(); node_num++){
        int valid = 1;
        string type;
        map<string, string> data;

        //Value::ConstMemberIterator itr_type = (*p_JSON_parent_array)[node_num].FindMember("type");
        //if(itr_type != (*p_JSON_parent_array)[node_num].MemberEnd()){
        if((*p_JSON_parent_array)[node_num].HasMember("type")){
            if((*p_JSON_parent_array)[node_num]["type"].IsString()){
                type = (*p_JSON_parent_array)[node_num]["type"].GetString();
            } else if((*p_JSON_parent_array)[node_num]["type"].IsNumber()){
                type = to_string((*p_JSON_parent_array)[node_num]["type"].GetDouble());
            } else {
                valid = 0;
            }
        } else {
            valid = 0;
        }
        
        if((*p_JSON_parent_array)[node_num].HasMember("data")){
            for(Value::ConstMemberIterator itr_conents = (*p_JSON_parent_array)[node_num]["data"].MemberBegin(); 
                    itr_conents != (*p_JSON_parent_array)[node_num]["data"].MemberEnd(); ++itr_conents){
                if(itr_conents->value.IsString()){
                    data[itr_conents->name.GetString()] = itr_conents->value.GetString();
                } else if(itr_conents->value.IsNumber()){
                    data[itr_conents->name.GetString()] = to_string(itr_conents->value.GetDouble());
                }
                //cout << itr_conents->name.GetString() << "\t" << data[itr_conents->name.GetString()] << endl;
            }
        } else {
            valid = 0;
        }
        
        if(valid){
            if(type == "cyclicBufferInput"){
                // This is data dump to a cyclicBuffer.
                cout << (*p_JSON_parent_array)[node_num]["data"]["val"]["0"].GetString() << endl;
                
                if((*p_JSON_parent_array)[node_num]["data"].HasMember("val") && (*p_JSON_parent_array)[node_num]["data"].HasMember("label")){
                    int time;
                    double value;
                    string label = (*p_JSON_parent_array)[node_num]["data"]["label"].GetString();

                    for(Value::ConstMemberIterator itr_val = (*p_JSON_parent_array)[node_num]["data"]["val"].MemberBegin(); 
                            itr_val != (*p_JSON_parent_array)[node_num]["data"]["val"].MemberEnd(); ++itr_val){
                        //cout << itr_val->name.GetString() << "\t" << itr_val->value.GetString() << endl;
                        try{
                            time = atoi(itr_val->name.GetString());
                            value = atof(itr_val->value.GetString());
                            Cyclic::lookup(label)->overwriteValue(time, value);
                        } catch(const std::invalid_argument& e){
                            cout << "malformed input for: " << e.what() << endl;
                        }
                    }
                } else {
                    cout << "Malformed JSON." << endl;
                }
            } else {
                // This is a regular update. Save in the DB.
                if(data.count("label") == 0){
                    data["label"] = "";
                }
                if(data.count("key") == 0){
                    data["key"] = "";
                }
                if(data.count("val") == 0){
                    data["val"] = "";
                }

                struct data_node new_node;
                new_node.type = type;
                new_node.data = data;
                time(&(new_node.time));

                data_nodes.push(&new_node);
            }
        }
    }
    return 0;
}

void InternalToJSON(Document* p_JSON_output, map<string, string>* p_arguments){
    time_t time_now;
    time(&time_now);

    vector<struct data_node> found_nodes = data_nodes.lookup(p_arguments);

    p_JSON_output->SetArray();
    for(vector<struct data_node>::iterator it = found_nodes.begin(); it != found_nodes.end(); ++it){
        Value type;
        type.SetString(it->type.c_str(), strlen(it->type.c_str()), p_JSON_output->GetAllocator());
        Value age;
        age.SetInt(time_now - it->time);
        Value data(kObjectType);

        for(map<string, string>::iterator it_data=it->data.begin(); it_data!=it->data.end(); ++it_data){
            Value key, val;
            key.SetString(it_data->first.c_str(), strlen(it_data->first.c_str()), p_JSON_output->GetAllocator());
            val.SetString(it_data->second.c_str(), strlen(it_data->second.c_str()), p_JSON_output->GetAllocator());
            data.AddMember(key, val, p_JSON_output->GetAllocator());
        }
        Value node(kObjectType);
        node.AddMember("type", type, p_JSON_output->GetAllocator());
        node.AddMember("age", age, p_JSON_output->GetAllocator());
        node.AddMember("data", data, p_JSON_output->GetAllocator());
        p_JSON_output->PushBack(node, p_JSON_output->GetAllocator());
    }
}

void GetData(string type, int age, string key, string label, vector<struct data_node>* p_retVals){
    map<string, string> arguments;
    Document array;

    arguments["type"] = type;
    arguments["age"] = to_string(age);
    arguments["data"] = "";
    if(key != ""){
        arguments["data"] += "\"key\":\"" + key + "\"";
    }
    if(label != ""){
        if(arguments["data"] != ""){
            arguments["data"] += ",";
        }
        arguments["data"] += "\"label\":\"" + label + "\"";
    }
    if(arguments["data"] != ""){
        arguments["data"]  = "{" + arguments["data"] + "}";
    }

    data_nodes.lookup(&arguments, p_retVals);
}

void GetData(string type, int age, string key, string label, map<string,string>* p_retVals){
    vector<struct data_node> data_node_list;
    GetData(type, age, key, label, &data_node_list);

    p_retVals->clear();
    for(auto it = data_node_list.begin(); it != data_node_list.end(); ++it){
        (*p_retVals)[it->data["key"]] = it->data["val"];
    }
}

void GetData(string type, int age, string key, string label, map<string,int>* p_retVals){
    vector<struct data_node> data_node_list;
    GetData(type, age, key, label, &data_node_list);

    p_retVals->clear();
    for(auto it = data_node_list.begin(); it != data_node_list.end(); ++it){
        try{
            (*p_retVals)[it->data["key"]] = stoi(it->data["val"]);
        } catch(const std::invalid_argument& e){
            cout << "GetData() stoi error key: " << it->data["key"] << "\t error: " << e.what() << endl;
            (*p_retVals)[it->data["key"]] = 0;
        }
    }   
}

void GetData(string type, int age, string key, string label, map<string,double>* p_retVals){
    vector<struct data_node> data_node_list;
    GetData(type, age, key, label, &data_node_list);

    p_retVals->clear();
    for(auto it = data_node_list.begin(); it != data_node_list.end(); ++it){
        try{
            (*p_retVals)[it->data["key"]] = stod(it->data["val"]);
        } catch(const std::invalid_argument& e){
            cout << "GetData() stod error key: " << it->data["key"] << "\t error: " << e.what() << endl;
            (*p_retVals)[it->data["key"]] = 0;
        }
    }   
}


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
            //arg_data = libjson::parse(it_arguments->second);
            arg_data.Parse(it_arguments->second.c_str()); 
        }
        if(it_arguments->first == "age"){
            // TODO find way to sanitize input. (isdigit()?)
            arg_age = stoi(it_arguments->second);

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
                return_list.push_back(potential_node);
            }

        }
    }
    lock_container.unlock();

    return return_list;
}

struct s_data_nodes data_nodes;

/*
ParseJSON::ParseJSON(const char* json_text, int(*callback)(string type, map<string, string> data)){
    //cout << json_text << endl;
    RegisterCallback(callback);
    JSONNode n;
    error = 0;
    try{
        n = libjson::parse(json_text);
    } catch(std::invalid_argument exception){
        cout << "Invalid JSON: " << json_text << endl;
        error = 1;
        return;
    }
    ParseNode(n);
}


void ParseJSON::ParseNode(const JSONNode & n){
    int current_depth = 0;
    int seen_type = -1;
    int seen_data = -1;
    map<string, string> possible_data;
    string possible_type;

    ParseNode(n, &current_depth, &seen_type, &seen_data, &possible_data, &possible_type);
}

void ParseJSON::ParseNode(const JSONNode & n, int* p_current_depth, int* p_seen_type, int* p_seen_data, map<string, string>* p_possible_data, string* p_possible_type){
    JSONNode::const_iterator itterator = n.begin();
    while (itterator != n.end()){
        if(itterator->type() != JSON_NULL){

            if(*p_seen_type == -1 && itterator->name() == "type" && itterator->type() == JSON_STRING && (*p_seen_data == *p_current_depth || *p_seen_data == -1)){
                // First seen the name: "type".
                *p_seen_type = *p_current_depth;
                *p_possible_type = itterator->as_string();
            }
            if(*p_seen_data == -1 && itterator->name() == "data" && itterator->type() == JSON_NODE && (*p_seen_type == *p_current_depth || *p_seen_type == -1)){
                // First seen the name: "data".
                *p_seen_data = *p_current_depth;
                p_possible_data->clear();
            } else if(*p_seen_data > -1 && *p_seen_data < *p_current_depth){
                // Child nodes contain data we potentially want to save.
                (*p_possible_data)[itterator->name()] = itterator->as_string();
            }

            // recursively call ourselves to dig deeper into the tree
            if(itterator->type() == JSON_ARRAY || itterator->type() == JSON_NODE){
                ++(*p_current_depth);
                ParseNode(*itterator, p_current_depth, p_seen_type, p_seen_data, p_possible_data, p_possible_type);
                --(*p_current_depth);

                if(*p_current_depth > 0 && *p_seen_type == *p_current_depth && *p_seen_data == *p_current_depth){
                    // Since we have parsed a whole element, do callback function.
                    (*p_callback)(*p_possible_type, *p_possible_data);
                }

                *p_seen_type = -1;
                *p_seen_data = -1;
            }

            //increment the iterator
            ++itterator;
        }
    }
}

void ParseJSON::RegisterCallback(int(*callback)(string type, map<string, string> data)){
    p_callback = callback;
}*/

int JSONtoInternal(Document* p_JSON_input){
    cout << p_JSON_input->GetType() << endl;
    cout << p_JSON_input->IsArray() << endl;

    Document* p_JSON_parent_array;
    p_JSON_parent_array->SetArray();

    if(p_JSON_input->IsObject()){
        // We have a single object rather than the expected array.
        // Let's presume it is a valid object and put it in an array.
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

        Value::ConstMemberIterator itr_type = (*p_JSON_parent_array)[node_num].FindMember("type");
        if(itr_type != (*p_JSON_parent_array)[node_num].MemberEnd()){
            type = itr_type->value.GetString();
        } else {
            valid = 0;
        }
        
        Value::ConstMemberIterator itr_data = (*p_JSON_parent_array)[node_num].FindMember("data");
        if(itr_data != (*p_JSON_parent_array)[node_num].MemberEnd()){
            for (Value::ConstMemberIterator itr_conents = itr_data->value.MemberBegin(); itr_conents != itr_data->value.MemberEnd(); ++itr_conents){
                data[itr_conents->name.GetString()] = itr_conents->value.GetString();
            }
        } else {
            valid = 0;
        }

        // Must have "type" and "data" values.
        if(valid){
            struct data_node new_node;
            new_node.type = type;
            new_node.data = data;
            time(&(new_node.time));

            data_nodes.push(&new_node);
        }
    }
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

/*
int dataFromInternalSave(string type, map<string, string> data){
    struct data_node new_node;
    new_node.type = type;
    new_node.data = data;
    time(&(new_node.time));

    data_nodes.push(&new_node);
    return 0;
}
*/

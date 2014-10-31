
#include "json.h"

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
}

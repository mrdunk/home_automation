#include "wsServer.h"

using namespace std;


string get_path(const string url){
    std::size_t found = url.find_first_of("?");
    if(found == std::string::npos){
        return url;
    } 
    return url.substr(0, found);
}

int parse_url(const string url, string* p_path, map<string, string>* p_arguments){
    string arg_str;
    string chunk;

    std::size_t found = url.find_first_of("?");
    if(found == std::string::npos){
        *p_path = url;
    } else {
        *p_path = url.substr(0, found);
        arg_str = url.substr(found, url.size());

        while(arg_str.size()){
            found = arg_str.find_last_of("&");
            if(found == arg_str.size() -1){
                // This is the last character in the string so just remove it.
                arg_str.pop_back();
            } else {
                if(found == std::string::npos){
                    found = 0;
                }
                chunk = arg_str.substr(found +1, arg_str.size());
                arg_str.erase(found, arg_str.size());

                found = chunk.find_first_of("=");
                if(found == std::string::npos){
                    (*p_arguments)[chunk] = "";
                } else {
                    (*p_arguments)[chunk.substr(0, found)] = chunk.substr(found+1, chunk.size());
                }
            }
        }
    }
    cout << "path:    " << *p_path << endl;
    cout << "arg_str: " << arg_str << endl;
    for (auto& x: *p_arguments) {
        std::cout << x.first << ": " << x.second << '\n';
    }
    return 0;
}

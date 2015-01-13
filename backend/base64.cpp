#include "base64.h"
#include <iostream>   // std::cout
#include <memory>       // unique_ptr

using namespace std;

std::string base64_decode(std::string const& encoded_string) {
    unsigned int i, val;
    string retVal = "", segment;

    if(encoded_string.size() %2){
        // String length is odd.
        // Error
        return "";
    }

    for(i = 0; i < encoded_string.size(); i += 2){
        segment = encoded_string.c_str()[i];
        segment += encoded_string.c_str()[i+1];
        
        try{
            val = stoi(segment, 0, 16);
        } catch(const invalid_argument& e){
            return "";
        }
        retVal += (char)val;
    }

    return retVal;
}

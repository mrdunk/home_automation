#include "base64.h"
#include <iostream>

#include <iostream>   // std::cout

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

        val = stoi(segment, 0, 16);
        retVal += (char)val;
    }

    return retVal;
}

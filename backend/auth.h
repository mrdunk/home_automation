#ifndef AUTH_H
#define AUTH_H

#include <string>     // std::string, std::to_string
#include <iostream>   // std::cout
#include <vector>
#include <mutex>

#include <cryptopp/aes.h>
#include <cryptopp/modes.h>

#include "base64.h"
#include "cyclicStore.h"


using namespace std;


class Auth{
        static mutex lockUserList;
        static vector<string> validUsers;
        FileUtils* p_fileUtilsInstance;
    public:
        Auth(FileUtils* _p_fileUtilsInstance);
        virtual void populateUsers(string path, string filename);
        virtual string decrypt(string inputText, string* p_decrypted);
};






#endif  // AUTH_H

#ifndef AUTH_H
#define AUTH_H

#include <string>     // std::string, std::to_string
#include <iostream>   // std::cout
#include <vector>
#include <mutex>

#include <cryptopp/aes.h>
#include <cryptopp/modes.h>

#include <sys/types.h>
#include <ifaddrs.h>
       #include <arpa/inet.h>
       #include <sys/socket.h>
       #include <netdb.h>
       #include <stdio.h>
       #include <stdlib.h>
       #include <unistd.h>
       #include <linux/if_link.h>

#include "base64.h"
#include "fileUtils.h"


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

// http://www.stev.org/post/2012/08/09/C++-Check-an-IP-Address-is-in-a-IPMask-range.aspx
/* Convert IP address into 32bit number. */
uint32_t IPToUInt(const string ipString);

/* Convert IP 32bit number into 4 x octet address. */
string IPToString(const uint32_t ipNum);

/* See if 2 IP addrresses are on the same network subnet. */
bool IPShareNetwork(const string ip1, const string ip2, const string mask);

/* See if address is on same network as local machine. */
bool IsAddressOnLocal(string address, string* _localAddress, string* _localMask);

#endif  // AUTH_H

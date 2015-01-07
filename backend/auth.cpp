
#include "auth.h"

using namespace std;
using namespace CryptoPP;

mutex Auth::lockUserList;
vector<string> Auth::validUsers;

Auth::Auth(FileUtils* _p_fileUtilsInstance): p_fileUtilsInstance(_p_fileUtilsInstance){
}

void Auth::populateUsers(string path, string filename){
    lockUserList.lock();

    string line;
    do{
        p_fileUtilsInstance->readLine(path, filename, &line);
        if(line != ""){
            line.erase(line.find(" "), line.size());
            cout << "* |" << line << "|" << endl;
            validUsers.push_back(line);
        }
    } while(line != "");
    lockUserList.unlock();
}

string Auth::decrypt(string inputText, string* p_decrypted){
    char key[] = "donkeyarsemonkeydynamyte";

    string cipherText = base64_decode(inputText);

    char plainText[64];
    strncpy(plainText, cipherText.c_str(), 63);

    int messageLen = (int)strlen(plainText) + 1;
    
    ECB_Mode<AES>::Decryption cfbDecryption((byte*)key, 16);
    cfbDecryption.ProcessString((byte*)plainText, messageLen);

    if(strchr(plainText,' ') != NULL){
        // Replace first space in string with null character.
        *strchr(plainText,' ') = 0;
    }

    // Check for charicters outside vald ascii range.
    for(unsigned int c = 0; c < sizeof(plainText) -1; ++c){
        if(plainText[c] == 0){
            break;
        }
        if(plainText[c] <= 31 || plainText[c] >= 127){
            *p_decrypted = "invalid username";
            return "";
        }
    }

    // Decrypted but not necisarily autherised.
    *p_decrypted = plainText;
    
    string retVal = "";
    lockUserList.lock();
    auto it = find (validUsers.begin(), validUsers.end(), plainText);

    if(it != validUsers.end()){
        retVal = plainText;
    }

    lockUserList.unlock();
    return retVal;
}



uint32_t IPToUInt(const string ipString) {
    int a, b, c, d;
    uint32_t addr = 0;
 
    if (sscanf(ipString.c_str(), "%d.%d.%d.%d", &a, &b, &c, &d) != 4)
        return 0;
 
    addr = a << 24;
    addr |= b << 16;
    addr |= c << 8;
    addr |= d;
    return addr;
}

string IPToString(const uint32_t ipNum){
    string oct1, oct2, oct3, oct4;
    oct1 = to_string((0xff000000 & ipNum) >> 24);
    oct2 = to_string((0x00ff0000 & ipNum) >> 16);
    oct3 = to_string((0x0000ff00 & ipNum) >> 8);
    oct4 = to_string((0x000000ff & ipNum));

    return oct1 + "." + oct2 + "." + oct3 + "." + oct4;
}

bool IPShareNetwork(const string ip1, const string ip2, const string mask){
    uint32_t ipNum1, ipNum2, maskNum;
    ipNum1 = IPToUInt(ip1);
    ipNum2 = IPToUInt(ip2);
    maskNum = IPToUInt(mask);

    ipNum1 &= maskNum;
    ipNum2 &= maskNum;

    //cout << IPToString(ipNum1) << "\t" << IPToString(ipNum2) << endl;
    return ipNum1 == ipNum2;
}


bool IsAddressOnLocal(string address, string* p_localAddress, string* p_localMask){
    static string localAddress = "";
    static string localMask = "";

    if(localAddress != ""){
        *p_localAddress = localAddress;
        *p_localMask = localMask;
        return IPShareNetwork(address, localAddress, localMask);
    }

    struct ifaddrs *ifaddr, *ifa;
    int family, s1, s2, n;
    char host[NI_MAXHOST];
    char mask[NI_MAXHOST];

    bool returnValue = 0;

    if (getifaddrs(&ifaddr) == -1) {
        perror("getifaddrs");
        exit(EXIT_FAILURE);
    }

    /* Walk through linked list, maintaining head pointer so we
       can free list later */

    for (ifa = ifaddr, n = 0; ifa != NULL; ifa = ifa->ifa_next, n++) {
        if (ifa->ifa_addr == NULL){
            continue;
        }

        family = ifa->ifa_addr->sa_family;
        if(family != AF_INET){
            continue;
        }

        s1 = getnameinfo(ifa->ifa_addr, sizeof(struct sockaddr_in), host, NI_MAXHOST, NULL, 0, NI_NUMERICHOST);
        if(s1 == 0){
            cout << "address: " << host << endl;
        }
        s2 = getnameinfo(ifa->ifa_netmask, sizeof(struct sockaddr_in), mask, NI_MAXHOST, NULL, 0, NI_NUMERICHOST);
        if(s2 == 0){ 
            cout << "mask:    " << mask << endl; 
        }
        if(IPShareNetwork(address, host, mask) and s1 == 0 and s2 == 0){
            localAddress = host;
            localMask = mask;
            *p_localAddress = localAddress;
            *p_localMask = localMask;
            returnValue = 1;
            break;
        }

    }

    freeifaddrs(ifaddr);

    return returnValue;
}




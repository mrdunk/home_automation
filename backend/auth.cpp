
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

    // Replace first space in string with null character.
    *strchr(plainText,' ') = 0;

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

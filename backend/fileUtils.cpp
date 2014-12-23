#include "fileUtils.h"

using namespace std;


FileUtils::FileUtils(StatWrapperInterface* p_Stater, OFstreamWrapper* p_OFstreamer, IFstreamWrapper* p_IFstreamer) : Stater(p_Stater), OFstreamer(p_OFstreamer), IFstreamer(p_IFstreamer){
}

mutex FileUtils::file_mutex;

int FileUtils::writable(const string path, const string filename){
    file_mutex.lock();
    int retVal;
    struct stat sb;
    if (Stater->_stat(path.c_str(), &sb) == -1) {
        retVal = -1;
        cout << "Unable to stat: " << path.c_str() << endl;
    } else if((sb.st_mode & S_IFMT) != S_IFDIR){
        retVal = -1;
        cout << "Directory missing: " << path.c_str() << endl;
    } else {
        retVal = 1;
    }

    // TODO test ability to read file.

    file_mutex.unlock();

    return retVal;
}

void FileUtils::write(const string path, const string filename, string data_to_write){
    cout << "writing: \"" + data_to_write << "\"" << endl;
    cout << "to:      " << path << filename << endl;

    if(writable(path, filename) > 0){
        file_mutex.lock();

        string full_path = path + "/" + filename;

        OFstreamer->ofStreamOpen(full_path.c_str(), ios::app);
        OFstreamer->ofStreamWrite(data_to_write);
        OFstreamer->ofStreamClose();

        cout << " done." << endl;
        file_mutex.unlock();
    }
}

void FileUtils::readLine(const string path, const string filename, string* data){
    *data = "";
    const string fullPath = path + "/" + filename;

    if(writable(path, filename) > 0){
        file_mutex.lock();

        int isOpen = IFstreamer->ifStreamIsOpen();
        if(fullPath != readFileName && isOpen == true){
            IFstreamer->ifStreamClose();
            readFileName = "";
        }

        if(isOpen != true){
            IFstreamer->ifStreamOpen((fullPath).c_str());
            readFileName = fullPath;
        }

        char buffer[1024];
        buffer[0] = 0;  // NULL terminate.
        IFstreamer->ifStreamGetline(buffer, 1024);
        *data = buffer;

        if(*data == ""){
            // Presume EOF.
            IFstreamer->ifStreamClose();
            readFileName = "";
        }
        file_mutex.unlock();
    }
}

void FileUtils::_rename(const string oldFilename, const string newFilename){
    file_mutex.lock();
    rename(oldFilename.c_str(), newFilename.c_str());
    file_mutex.unlock();
}


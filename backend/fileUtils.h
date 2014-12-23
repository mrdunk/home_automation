#ifndef FILEUTILS_H
#define FILEUTILS_H

#include <string>     // std::string, std::to_string
#include <fstream>
#include <sys/stat.h>
#include <iostream>   // std::cout
#include <mutex>
#include <map>
#include <algorithm>    // std::count
#include <vector>
#include <memory>       // unique_ptr

using namespace std;

/* Interfce for C++ stat() funtion. */
class StatWrapperInterface {
    public:
        virtual ~StatWrapperInterface(){};
        virtual int _stat(const char *path, struct stat *buf){
            return stat(path, buf);
        };

//    protected:
        StatWrapperInterface(){};
};


//class StatWrapper : public StatWrapperInterface{
//    public:
//        virtual int _stat(const char *path, struct stat *buf){
//            return stat(path, buf);
//        }
//};

class OFstreamWrapperInterface {
    public:
        virtual ~OFstreamWrapperInterface(){};
        virtual void ofStreamOpen(const char* filename, ios_base::openmode mode) = 0;
        virtual void ofStreamClose(void) = 0;
        virtual void ofStreamWrite(const string data_to_write) = 0;
    protected:
        OFstreamWrapperInterface(){};
};

class OFstreamWrapper : public OFstreamWrapperInterface{
    protected:
        ofstream ofStream;
    public:
        virtual void ofStreamOpen(const char* filename, ios_base::openmode mode){
            ofStream.open(filename, mode);
        }
        virtual void ofStreamClose(void){
            ofStream.close();
        }
        virtual void ofStreamWrite(const string data_to_write){
            ofStream << data_to_write << endl;
        }
};

class IFstreamWrapperInterface {
    public:
        virtual ~IFstreamWrapperInterface(){};
        virtual void ifStreamOpen(const char* filename) = 0;
        virtual bool ifStreamIsOpen() = 0;
        virtual void ifStreamGetline(char* s, streamsize n) = 0;
        virtual void ifStreamClose(void) = 0;
    protected:
        IFstreamWrapperInterface(){};
};

class IFstreamWrapper : public IFstreamWrapperInterface{
    protected:
        ifstream ifStream;
    public:
        virtual void ifStreamOpen(const char* filename){
            ifStream.open(filename);
        }
        virtual bool ifStreamIsOpen(){
            return ifStream.is_open();
        }
        virtual void ifStreamGetline(char* s, streamsize n){
            ifStream.getline(s, n);
        }
        virtual void ifStreamClose(void){
            ifStream.close();
        }
};

class FileUtilsInterface{
    public:
        virtual ~FileUtilsInterface(){};
        virtual void write(const string path, const string filename, string data_to_write) = 0;
        virtual int writable(const string path, const string filename) = 0;
        virtual void readLine(const string path, const string filename, string* data) = 0;
        virtual void _rename(const string oldFilename, const string newFilename) = 0;
    //protected:
    //    FileUtilsInterface(StatWrapperInterface* p_Stater, OFstreamWrapper* p_OFstreamer, IFstreamWrapper* p_IFstreamer);
};

class FileUtils : FileUtilsInterface {
    private:
        StatWrapperInterface* Stater;
        OFstreamWrapper* OFstreamer;
        IFstreamWrapper* IFstreamer;
        string readFileName;
        //const std::unique_ptr<StatWrapperInterface> Stater;
    public:
        FileUtils(StatWrapperInterface* p_Stater, OFstreamWrapper* p_OFstreamer, IFstreamWrapper* p_IFstreamer);

        /* Test whether path and filename are writable. */
        virtual int writable(const string path, const string filename);

        /* Append a line to file. */
        virtual void write(const string path, const string filename, string data_to_write);

        /* Read the next line from file. Subsiquent reads will read the next line.
         * If nothing is returned, the end of file has been reached.
         * The next time this function is called, it witt start from the top aagain. */
        virtual void readLine(const string path, const string filename, string* data);

        virtual void _rename(const string oldFilename, const string newFilename);

        /* Use this to lock all files accessed by all instances of this class. 
         * While the argument could be made locking all files is wasteful,
         * it's cheap to implement and threadsafe.*/
        static mutex file_mutex;
};


#endif  // FILEUTILS_H


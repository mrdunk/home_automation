#ifndef CYCLICSTORE_H
#define CYCLICSTORE_H

#include <string>     // std::string, std::to_string
#include <fstream>
#include <sys/stat.h>
#include <iostream>   // std::cout
#include <mutex>
#include <map>
#include <algorithm>    // std::count
#include <vector>
#include <memory>       // unique_ptr

#include "rapidjson/document.h"
#include "rapidjson/prettywriter.h"
#include "httpServer.h"

#define MINS_IN_WEEK 10080
#define MINS_IN_DAY 1440

using namespace std;
using namespace rapidjson;

class StatWrapperInterface {
    public:
        virtual ~StatWrapperInterface(){};
        virtual int _stat(const char *path, struct stat *buf) = 0;

    protected:
        StatWrapperInterface(){};
};

class StatWrapper : public StatWrapperInterface{
    public:
        virtual int _stat(const char *path, struct stat *buf){
            return stat(path, buf);
        }
};

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


class FileUtils {
    private:    
        StatWrapper* Stater;
        OFstreamWrapper* OFstreamer;
        IFstreamWrapper* IFstreamer;
        string readFileName;
        //const std::unique_ptr<StatWrapperInterface> Stater;
    public:
        FileUtils(StatWrapper* p_Stater, OFstreamWrapper* p_OFstreamer, IFstreamWrapper* p_IFstreamer);

        /* Test whether path and filename are writable. */
        virtual int writable(const string path, const string filename);

        /* Append a line to file. */
        void write(const string path, const string filename, string data_to_write);

        /* Read the next line from file. Subsiquent reads will read the next line.
         * If nothing is returned, the end of file has been reached.
         * The next time this function is called, it witt start from the top aagain. */
        void read_line(const string path, const string filename, string* data);

    protected:
        /* Use this to lock all files accessed by all instances of this class. 
         * While the argument could be made locking all files is wasteful,
         * it's cheap to implement and threadsafe.*/
        static mutex file_mutex;

        //virtual int _stat(const char *path, struct stat *buf) = 0;
};

/* Indexed storage container that loops back to begining when it reaches it's defined end.
 * Can be configured to average readings over many cycles.
 * Automaticaly saves data to disk as well as keeping cache in memory. */
class Cyclic : public FileUtils, public HttpCallback {
        string unique_id;
        int divisions;
        long long int average_total;
        unsigned int mins_per_division;
        unsigned int update_weight;
        float* p_container;
        int update_inertia;
        int previous_time;
        int previous_value;
        string working_dir;

        string filename_active;
        string filename_previous;

    public:
        /* Register all instances of this class. */
        static vector<Cyclic*> allCyclic;

        /* Args:
         *      _unique_id: Used for filename. Must be unique among all class instances.
         *      _mins_per_division: Number of minutes between samples.
         *      _mins_in_period: Number of minutes before looping back to start.
         *      _update_inertia: How much weight to give new data when averaging over multiple itterations.
         *          "1" means only this rounds data will be stored. Higher numbers mean new data has less affect.
         *      _default_value: Value to assign all values if a cache file cannot be found. */
        Cyclic(string _unique_id, unsigned int _mins_per_division, unsigned int _mins_in_period, unsigned int _update_inertia, int _default_value, string _working_dir);
        ~Cyclic(void);

        /* Return pointer to an instance of Cyclic based on unique_id.
         * Note that this function is static sh should not be called on an instance but rather as a class function:
         *      Cyclic::lookup("some_unique_id")->some_function(); */
        static Cyclic* lookup(string unique_id);

        /* Queue data to be committed at end of time segment. */
        void store(int time, int value);

        /* Return value associated with a time segment. */
        float read(int time);

        /* TODO */
        unsigned int calculate_average(void);

        /* Load values from cache file. TODO call this automatically from constructor. */
        void restore_from_disk(void);

        /* Export all values as JSON object. */
        void to_JSON(Document* p_JSON_output, int step_size);

        /* Export all values as JSON formatted string. */
        int to_JSON_string(std::string* p_buffer, map<string, string>* p_arguments);

        /* Set by constructor. Number of minutes before looping back to start. */
        int mins_in_period;

        /* Wrapper round to_JSON_string for HttpCallback. TODO can this be protected rather than public? */
        int textOutput(std::string* p_buffer, map<string, string>* p_arguments);
};



#endif  // CYCLICSTORE_H

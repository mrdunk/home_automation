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
#include "fileUtils.h"

#define MINS_IN_WEEK 10080
#define MINS_IN_DAY 1440

using namespace std;
using namespace rapidjson;


/* Indexed storage container that loops back to begining when it reaches it's defined end.
 * Can be configured to average readings over many cycles.
 * Automaticaly saves data to disk as well as keeping cache in memory. */
class Cyclic : public HttpCallback {
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

        FileUtils* p_fileUtilsInstance;
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
        Cyclic(string _unique_id, unsigned int _mins_per_division, unsigned int _mins_in_period, unsigned int _update_inertia, int _default_value, string _working_dir,
                FileUtils* _p_fileUtilsInstance);
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
        void restoreFromDisk(void);

        /* Export all values as JSON object. */
        void to_JSON(Document* p_JSON_output, int step_size);

        /* Export all values as JSON formatted string. */
        int to_JSON_string(std::string* p_buffer, map<string, string>* p_arguments);

        /* Set by constructor. Number of minutes before looping back to start. */
        int mins_in_period;

        /* Wrapper round to_JSON_string for HttpCallback.
         * TODO can this be protected rather than public? */
        int textOutput(std::string* p_buffer, map<string, string>* p_arguments);
};



#endif  // CYCLICSTORE_H

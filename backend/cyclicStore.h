#ifndef CYCLICSTORE_H
#define CYCLICSTORE_H

#include <string>     // std::string, std::to_string
#include <fstream>
#include <sys/stat.h>
#include <iostream>   // std::cout
#include <mutex>

#define MINS_IN_WEEK 10080
#define MINS_IN_DAY 1440

using namespace std;

class FileUtils{
        int path_exists;
    protected:
        FileUtils(void);
        int writable(const string path, const string filename);
        void write(const string path, const string filename, string data_to_write);
        void read(const string path, const string filename, string* data);
        mutex file_mutex;

};

class Cyclic : public FileUtils {
        string unique_id;
        int divisions;
        long long int average_total;
        unsigned int mins_per_division;
        unsigned int update_weight;
        int* p_container;
        unsigned int mins_in_period;
        int update_inertia;
        int previous_time;
        int previous_value;
        string working_dir;

        string filename_active;
        string filename_previous;
    public:
        Cyclic(string _unique_id, unsigned int _mins_per_division, unsigned int _mins_in_period, unsigned int _update_inertia, int _default_value);
        ~Cyclic(void);
        void store(int time, int value);
        float read(int time);
        unsigned int calculate_average(void);
        void register_path(const string _working_dir);
};



#endif  // CYCLICSTORE_H

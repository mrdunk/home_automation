#include "cyclicStore.h"

using namespace std;

FileUtils::FileUtils(void){
    int path_exists = 0;
}

int FileUtils::writable(const string path, const string filename){
    if(path_exists == 0){
        file_mutex.lock();
        // First time here. Check for directory.
        struct stat sb;
        if (stat(path.c_str(), &sb) == -1) {
            path_exists = -1;
            cout << "Unable to stat: " << path.c_str() << endl;
        } else if((sb.st_mode & S_IFMT) != S_IFDIR){
            path_exists = -1;
            cout << "Directory missing: " << path.c_str() << endl;
        } else {
            path_exists = 1;
        }

        // TODO test ability to read file.

        file_mutex.unlock();
    }
    return path_exists;
}

void FileUtils::write(const string path, const string filename, string data_to_write){
    cout << "writing: " + data_to_write << endl;
    cout << path << filename << "\t" << path_exists << endl;

    if(writable(path, filename) > 0){
        file_mutex.lock();
        string full_path = path + "/" + filename;
        ofstream out;
        out.open(full_path.c_str(), ios::app);
        out << data_to_write << endl;;
        out.close();
        cout << " done." << endl;
        file_mutex.unlock();
    }
}

void FileUtils::read(const string path, const string filename, string* data){
    file_mutex.lock();
    file_mutex.unlock();
}


Cyclic::Cyclic(string _unique_id, unsigned int _mins_per_division, unsigned int _mins_in_period,
               unsigned int _update_inertia, int _default_value) : FileUtils(){
    unique_id = _unique_id;
    update_inertia = _update_inertia;
    mins_per_division = _mins_per_division;
    divisions = _mins_in_period / _mins_per_division;
    int default_value = _default_value * _update_inertia;

    // Initialise p_container array.
    p_container = new int[divisions];
    fill(p_container, p_container + divisions, default_value);
    
    previous_time = -1;

    filename_active = _unique_id + "_active";
    filename_previous = _unique_id + "_previous";
}

Cyclic::~Cyclic(void){
    cout << "Closing Cyclic: " << unique_id << endl;
    delete p_container;
}

void Cyclic::register_path(const string _working_dir){
        working_dir = _working_dir;
}

void Cyclic::store(int time, int value){
    // Convert time to number of devisions.
    cout << "# " << time << "\t";
    time /= mins_per_division;
    while(time < 0){
        time += divisions;
    }
    while(time >= divisions){
        time -= divisions;
    }
    cout << time << "\t" << previous_time << endl;

    // If time has looped round to "0", pretend it didn't and extend relative_time beyond the maximum value.
    int relative_time = time;
    if(previous_time > time){
        relative_time += divisions;
    }

    // Only do things if the time is less than half a clock ahead of the last saved value.
    if((relative_time - previous_time) < (divisions / 2) || previous_time == -1){
        cout << "*" << endl;

        if(relative_time > previous_time && previous_time >= 0){
            // We have moved to a new time segment so save results from last cycle.
            // We don't save the data straight away so we get the last setting in a time segment.
            // This allows things like multiple user input events to only save the final setting.
            if(previous_time < divisions){
                //p_container[previous_time] = previous_value;
                p_container[previous_time] = (p_container[previous_time] * (update_inertia - 1) / update_inertia) + previous_value;

                // write p_container[time] to file.
                string output_line = to_string(previous_time) + " " + to_string(p_container[previous_time]);
                cout << working_dir << filename_active << " " << output_line << endl;
                write(working_dir, filename_active, output_line);

                if(previous_time > time){
                    // We have reached the end of one clock cycle and re-started the next.
                    string fn_a = working_dir + "/" + filename_active;
                    string fn_p = working_dir + "/" + filename_previous;
                    file_mutex.lock();
                    rename(fn_a.c_str(), fn_p.c_str());
                    file_mutex.unlock();
                }
            } else {
                cout << "Attempted to write outside alocated array." << endl;
            }
        }

        // "value" gets saved for writing in a future time segment.
        previous_value = value;
        previous_time = time;
    }
}

float Cyclic::read(int time){
    time /= mins_per_division;
    return (float)p_container[time] / update_inertia;
}

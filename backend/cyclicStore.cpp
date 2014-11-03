#include "cyclicStore.h"

using namespace std;
using namespace rapidjson;

FileUtils::FileUtils(void){
    path_exists = 0;
}

mutex FileUtils::file_mutex;

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
    cout << "writing: \"" + data_to_write << "\"" << endl;
    cout << "to:      " << path << filename << endl;

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

void FileUtils::read_line(const string path, const string filename, string* data){
    *data = "";

    if(writable(path, filename) > 0){
        file_mutex.lock();

        if(read_file.is_open() != true){
            read_file.open(path + "/" + filename);
        }

        char buffer[1024];
        read_file.getline(buffer, 1024);
        *data = buffer;

        if(*data == ""){
            // Presume EOF.
            read_file.close();
        }

        file_mutex.unlock();
    }
}


Cyclic::Cyclic(string _unique_id, unsigned int _mins_per_division, unsigned int _mins_in_period,
               unsigned int _update_inertia, int _default_value) : FileUtils(){
    unique_id = _unique_id;
    update_inertia = _update_inertia;
    mins_per_division = _mins_per_division;
    divisions = _mins_in_period / _mins_per_division;
    mins_in_period = _mins_in_period;
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
    time /= mins_per_division;
    while(time < 0){
        time += divisions;
    }
    while(time >= divisions){
        time -= divisions;
    }

    // If time has looped round to "0", pretend it didn't and extend relative_time beyond the maximum value.
    int relative_time = time;
    if(previous_time > time){
        relative_time += divisions;
    }

    // Only do things if the time is less than half a clock ahead of the last saved value.
    if((relative_time - previous_time) < (divisions / 2) || previous_time == -1){

        if(relative_time > previous_time && previous_time >= 0){
            // We have moved to a new time segment so save results from last cycle.
            // We don't save the data straight away so we get the last setting in a time segment.
            // This allows things like multiple user input events to only save the final setting.
            if(previous_time < divisions){
                //p_container[previous_time] = previous_value;
                p_container[previous_time] = (p_container[previous_time] * (update_inertia - 1) / update_inertia) + previous_value;

                // write p_container[time] to file.
                string output_line = to_string(previous_time) + " " + to_string(p_container[previous_time]);
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

/* Re-populate memory from cache files on disk.*/
void Cyclic::restore_from_disk(void){
    string line;
    unsigned int pos;
    int time, val;

    string filename = filename_previous;

    // Re-populate the older data first (filename_previous) so any entries in the newer file (filename_active) overwrite the older ones.
    while(filename == filename_previous || filename == filename_active){
        read_line(working_dir, filename_active, &line);
        if(line != ""){
            cout << line << endl;
            while((pos = line.find(" ")) != std::string::npos) {
                cout << "t " << line.substr(0, pos) << endl;
                time = stoi(line.substr(0, pos));
                line.erase(0, pos + 1);
            }
            cout << "v " << line << endl;
            val = stoi(line);

            if(time >= 0 && time < divisions){
                p_container[time] = val;
            }
        } else {
            // Empty line from file so presume we have reaced the end.
            if(filename == filename_previous){
                filename = filename_active;
            } else if(filename == filename_active){
                filename = "invalid";
            }
            cout << filename << endl;
        }
    }

    // Now we have re-populated the container in memory,
    // let's write everyhting we know about to filename_active.
    // 
    // We write to filename_active because when we get to the ned of a time segment
    // and filename_active is copied over filename_previous 
    // we want to make sure there is at least one entry for every time slot.
    // If the filename_active we start writing to does not contain a full set, there would be gaps
    // in the new filename_previous.
    string filename_temp = filename_active + "_temp";

    string fn_t = working_dir + "/" + filename_temp;
    string fn_a = working_dir + "/" + filename_active;
    string fn_p = working_dir + "/" + filename_previous;
    
    // Remove any only temp file.
    remove(fn_t.c_str());

    string data_to_write;
    for(time = 0; time < mins_in_period; time += mins_per_division){
        data_to_write = to_string(time / mins_per_division) + " " + to_string(read(time) * update_inertia);
        write(working_dir, filename_temp, data_to_write);
    }

    file_mutex.lock();
    // Copy the temp file over the active one.
    rename(fn_t.c_str(), fn_a.c_str());
    
    // and delete the previous one.
    remove(fn_p.c_str());

    file_mutex.unlock();
}

void Cyclic::to_JSON(Document* p_JSON_output, int step_size){
    if(step_size <= 0){
        step_size = mins_per_division;
    }
    p_JSON_output->SetObject();
    for(int time = 0; time < mins_in_period; time += step_size){
        Value key, val;
        key.SetString(to_string(time).c_str(), p_JSON_output->GetAllocator());
        val.SetString(to_string(read(time)).c_str(), p_JSON_output->GetAllocator());
        p_JSON_output->AddMember(key, val, p_JSON_output->GetAllocator());
    }
}

int Cyclic::to_JSON_string(std::string* p_buffer, map<string, string>* p_arguments){
    int step_size = 0;
    if(p_arguments->count("step_size")){
        step_size = stoi(p_arguments->find("step_size")->second);
    }
    Document array;
    to_JSON(&array, step_size);

    if(p_arguments->count("pretty")){
        StringBuffer buffer;
        PrettyWriter<StringBuffer> writer(buffer);
        array.Accept(writer);
        *p_buffer = buffer.GetString();
    } else {
        StringBuffer buffer;
        Writer<StringBuffer> writer(buffer);
        array.Accept(writer);
        *p_buffer = buffer.GetString();
    }
    return 0;
}

int Cyclic::textOutput(std::string* p_buffer, map<string, string>* p_arguments){
    return to_JSON_string(p_buffer, p_arguments);
}

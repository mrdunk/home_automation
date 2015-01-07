#include "cyclicStore.h"

using namespace std;
using namespace rapidjson;



vector<Cyclic*> Cyclic::allCyclic;

Cyclic::Cyclic(string _unique_id, unsigned int _mins_per_division, unsigned int _mins_in_period,
               unsigned int _update_inertia, int _default_value, string _working_dir, FileUtils* _p_fileUtilsInstance) : 
               unique_id(_unique_id),
               mins_per_division(_mins_per_division),
               update_inertia(_update_inertia),
               working_dir(_working_dir),
               p_fileUtilsInstance(_p_fileUtilsInstance),
               mins_in_period(_mins_in_period){

    divisions = _mins_in_period / _mins_per_division;

    int default_value = _default_value * _update_inertia;

    // Initialise p_container array.
    p_container = new float[divisions];
        
    fill(p_container, p_container + divisions, default_value);
    
    previous_time = -1;

    filename_active = _unique_id + "_active";
    filename_previous = _unique_id + "_previous";

    if(count(allCyclic.begin(), allCyclic.end(), this) == 0){
        // This instance not in buffer yet.
        allCyclic.push_back(this);
    }
}

Cyclic::~Cyclic(void){
    cout << "Closing Cyclic: " << unique_id << endl;
    delete p_container;
    if(count(allCyclic.begin(), allCyclic.end(), this)){
        allCyclic.erase(remove(allCyclic.begin(), allCyclic.end(), this), allCyclic.end());
    }
}

Cyclic* Cyclic::lookup(string unique_id){
    for(std::vector<Cyclic*>::iterator it = allCyclic.begin(); it != allCyclic.end(); ++it){
        if((*it)->unique_id == unique_id){
            return *it;
        }
    }
    return NULL;
}

void Cyclic::overwriteValue(int _time, int value){
    // Convert time to number of devisions.
    int time = _time / mins_per_division;
    while(time < 0){
        time += divisions;
    }
    while(time >= divisions){
        time -= divisions;
    }

    p_container[time] = value;

    // write p_container[time] to file.
    string output_line = to_string(time) + " " +
        to_string(p_container[time]);
    p_fileUtilsInstance->write(working_dir, filename_active, output_line);
}

void Cyclic::store(int _time, int value){
    // Convert time to number of devisions.
    int time = _time / mins_per_division;
    while(time < 0){
        time += divisions;
    }
    while(time >= divisions){
        time -= divisions;
    }

    // If time has looped round to "0",
    // pretend it didn't and extend relative_time beyond the maximum value.
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
                cout << "time: " << _time << " " << time << endl;
                cout << "previous value: " << p_container[previous_time] << " " << 
                    previous_value << endl;
                p_container[previous_time] = (p_container[previous_time] * (update_inertia - 1) / 
                        update_inertia) + previous_value;
                cout << "new value:      " << p_container[previous_time] << endl;

                // write p_container[time] to file.
                string output_line = to_string(previous_time) + " " + 
                    to_string(p_container[previous_time]);
                p_fileUtilsInstance->write(working_dir, filename_active, output_line);

                if(previous_time > time){
                    // We have reached the end of one clock cycle and re-started the next.
                    string fn_a = working_dir + "/" + filename_active;
                    string fn_p = working_dir + "/" + filename_previous;
                    p_fileUtilsInstance->_rename(fn_a, fn_p);
                }
            } else {
                cout << "Attempted to write outside alocated array." << endl;
            }

            previous_time = time;
        } else if(previous_time < 0){
            previous_time = time;
        }
        // "value" gets saved for writing in a future time segment. 
        previous_value = value;
    }
}

float Cyclic::read(int time){
    time /= mins_per_division;
    return (float)p_container[time] / update_inertia;
}

/* Re-populate memory from cache files on disk.*/
void Cyclic::restoreFromDisk(void){
    string line;
    unsigned int pos;
    int time = 0;
    float val;

    // Re-populate the older data first (filename_previous)
    // so any entries in the newer file (filename_active) overwrite the older ones.
    string filename = filename_previous;
    while(filename == filename_previous || filename == filename_active){
        p_fileUtilsInstance->readLine(working_dir, filename, &line);
        if(line != ""){
            cout << "string: " << line << "\t";
            while((pos = line.find(" ")) != std::string::npos) {
                cout << "t: " << line.substr(0, pos) << "\t";
                time = stoi(line.substr(0, pos));
                line.erase(0, pos + 1);
            }
            val = stod(line);
            cout << "v: " << val << endl;

            if(time >= 0 && time < divisions){
                p_container[time] = val;
            }
        } else {
            // Empty line from file so presume we have reached the end.
            if(filename == filename_previous){
                filename = filename_active;
            } else if(filename == filename_active){
                filename = "invalid";
            }
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
    
    // Remove any old temp file.
    remove(fn_t.c_str());

    string data_to_write;
    for(time = 0; time < mins_in_period; time += mins_per_division){
        data_to_write = to_string(time / mins_per_division) + " " +
            to_string(read(time) * update_inertia);
        p_fileUtilsInstance->write(working_dir, filename_temp, data_to_write);
    }

    p_fileUtilsInstance->file_mutex.lock();
    // Copy the temp file over the active one.
    rename(fn_t.c_str(), fn_a.c_str());
    
    // and delete the previous one.
    remove(fn_p.c_str());

    p_fileUtilsInstance->file_mutex.unlock();
}

void Cyclic::to_JSON(Document* p_JSON_output, int step_size){
    if(step_size <= 0){
        step_size = mins_per_division;
    }

    Value content(kObjectType);
    for(int time = 0; time < mins_in_period; time += step_size){
        Value key, val;
        key.SetString(to_string(time).c_str(), p_JSON_output->GetAllocator());
        val.SetString(to_string(read(time)).c_str(), p_JSON_output->GetAllocator());
        content.AddMember(key, val, p_JSON_output->GetAllocator());
    }

    Value data(kObjectType);
    Value key;
    Value label;
    key.SetString(unique_id.c_str(), p_JSON_output->GetAllocator());
    label.SetString(unique_id.c_str(), p_JSON_output->GetAllocator());
    data.AddMember("key", key, p_JSON_output->GetAllocator());
    data.AddMember("val", content, p_JSON_output->GetAllocator());
    data.AddMember("label", label, p_JSON_output->GetAllocator());

    p_JSON_output->SetArray();
    Value node(kObjectType);
    node.AddMember("type", "cyclicBuffer", p_JSON_output->GetAllocator());
    node.AddMember("data", data, p_JSON_output->GetAllocator());
    p_JSON_output->PushBack(node, p_JSON_output->GetAllocator());
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

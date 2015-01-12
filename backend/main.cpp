#include "httpServer.h"
#include "json.h"
#include "cyclicStore.h"
#include "rapidjson/prettywriter.h"
#include "wsServer.h"

#include <map>
#include <vector>
#include <mutex>
#include <fstream>
#include <sys/stat.h>
#include <thread>           // std::thread
#include <algorithm>        // std::count

#define MIN_TEMP -55    // degrees centegrade
#define MAX_TEMP 125    // degrees centegrade

#define READAHEAD 30    // control temperature acording to how it is set this far in the future.

using namespace std;

/* [ { 'type': STRING, 
 *     'data': {'host': STRING,
 *              'label': STRING,
 *              'key': STRING,
 *              'val': STRING
 *             }
 *   },
 *   { etc..}
 * ]
 */

string data_path = "";

StatWrapperInterface statWrapper;
OFstreamWrapper ofStreamWrapper;
IFstreamWrapper ifStreamWrapper;

FileUtils fileUtilsInstance(&statWrapper, &ofStreamWrapper, &ifStreamWrapper);

Auth authInstance(&fileUtilsInstance);

/* All threads should exit if run==0. */
int run = 1;

/* Gets called whenever POST data arrives over http. */
int CallbackPost(std::string* p_buffer, map<string, string>* p_arguments){
    //cout << "CallbackPost " << p_buffer->c_str() << endl;
    Document document;
    document.Parse(p_buffer->c_str());
    if(JSONtoInternal(&document)){
        (*p_arguments)["error"] = "yes";
        cout << p_buffer->c_str() << endl;
        return 1;
    }
    return 0;
}

/* Return JSON formated text in response to GET. */
int CallbackGetData(std::string* p_buffer, map<string, string>* p_arguments){
    Document array;
    InternalToJSON(&array, p_arguments);

    //cout << KeyFromArguments(p_arguments) << endl;

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

/* Save configuration to disk cache. */
int CallbackSave(std::string* p_buffer, map<string, string>* p_arguments){
    if(fileUtilsInstance.writable(data_path, "configuration") != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    // Path exists and is writable.
    string buffer;
    map<string, string> arguments_to_save;
    arguments_to_save["type"] = "configuration";
    arguments_to_save["pretty"] = "1";
    CallbackGetData(&buffer, &arguments_to_save);

    fileUtilsInstance.write(data_path, "test", buffer);

    *p_buffer = "ok";
    return 0;
}

/* Read saved configuration to disk cache. */
int CallbackRead(std::string* p_buffer, map<string, string>* p_arguments){
    if(fileUtilsInstance.writable(data_path, "configuration") != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    string line, buffer;
    do{
        fileUtilsInstance.readLine(data_path, "test", &line);
        buffer += line + "\n";
    }while(line != "");

    map<string, string> unused_map;
    if(CallbackPost(&buffer, &unused_map)){
        *p_buffer = "Error reading cached config.";
        return 1;
    }
    *p_buffer = "ok";

    return 0;
}

/* How many minutes have passed since the start of the week.
 * Sunday is the first day of the week. */
int minutesIntoWeek(void){
    time_t rawtime;
    struct tm * timeinfo;
    char day[2];
    char hour[3];
    char minute[3];

    time(&rawtime);
    timeinfo = localtime(&rawtime);

    strftime(day, 2, "%w", timeinfo);
    strftime(hour, 3, "%H", timeinfo);
    strftime(minute, 3, "%M", timeinfo);
    
    int ret_val = (stoi(day) * 24 * 60) + (stoi(hour) * 60) + stoi(minute);

    return ret_val;
}

int SwitchHeating(int state){
    string jsonText = "[{\"type\":\"output\",\"data\":{\"key\":\"heatOnOff\",\"label\":\"output\",\"val\":\"" + to_string(state) + "\"}}]";
    Document document;
    document.Parse(jsonText.c_str());
    return JSONtoInternal(&document);
}

int ClearUserInput(void){
    string jsonText = "[{\"type\":\"userInput\",\"data\":{\"key\":\"heatOnOff\",\"label\":\"controler\",\"val\":\"0\"}}]";
    Document document;
    document.Parse(jsonText.c_str());
    return JSONtoInternal(&document);
}

void houseKeeping(void){
    // Counter for main event loop.
    int counter;

    map<string, string> arguments;
    Document array;

    // Average value of all temperature sensors.
    float averageTemperature;
    int activeTemperatureSensors;

    // The saved temperature for this time.
    float configuredTemperature;

    // Chance of users being home.
    float usersAtHome;

    // User input button value.
    int userInput;

    // Tempary holder for user desision when it disagrees with configured value.
    int userOveride;

    // Whether heating is switched on or off.
    int heatingState = 0;

    // Current time (in minutes after start of week).
    int mins;

    while(run){
        //cout << "-" << endl;
        counter = 0;
        // Sleep for 30 seconds.
        while(run && ++counter < 6){
            sleep(5);
        }
        //cout << "+" << endl;

        mins = minutesIntoWeek();

        // Calculate average temperature of all temperature sensrs.
        map<string,double> temperatureValues;
        GetData("sensors", 300, "", "1wire", &temperatureValues);
        activeTemperatureSensors = averageTemperature = 0;
        for(auto it_temperature = temperatureValues.begin(); it_temperature!=temperatureValues.end(); ++it_temperature){
            ++activeTemperatureSensors;
            averageTemperature += it_temperature->second;
        }
        averageTemperature /= activeTemperatureSensors;


        // Save any user input from the last 60 minutes.
        map<string,int> userInputValues;
        GetData("userInput", 60*60, "", "", &userInputValues);
        userInput = 0;
        if(userInputValues.size()){
            userInput = userInputValues.begin()->second;
        } else {
            // Storing a null userInput value means there is less work to do on the client, checking time stamps, etc.
            ClearUserInput();
        }


        // Get all active devices on network in the last 5 minutes.
        // We only need save the key as it is the MAC address.
        map<string,string> networkClients;
        GetData("sensors", 900, "", "net_clients", &networkClients);

        // Now cross refernce those with devices that have people assigned to them.
        // TODO make a setting that allows us to opt a paticular device in/out of this count.
        map<string,string> userDevices;
        GetData("configuration", 0, "", "userId", &userDevices);
        vector<string> unique_users;
        for(auto it_userDevs = userDevices.begin(); it_userDevs != userDevices.end(); ++it_userDevs){
            string macAddr = it_userDevs->first;
            string userId = it_userDevs->second;
            if(userId != "none" && networkClients.count(macAddr) > 0 && count(unique_users.begin(), unique_users.end(), macAddr) == 0){
                unique_users.push_back(macAddr);
            }
        }

        Cyclic::lookup("whos_home_1_week")->store(mins, unique_users.size());

        configuredTemperature = Cyclic::lookup("temp_setting_1_week")->read(mins);
        if(unique_users.size() > 0){
            usersAtHome = 1;
        } else {
            usersAtHome = Cyclic::lookup("whos_home_1_week")->read(mins + READAHEAD);
        }
        
        cout << "averageTemperature: " << averageTemperature << "\t" << activeTemperatureSensors << endl;
        cout << "userInput: " << userInput << endl;
        cout << "configuredTemperature: " << configuredTemperature << endl;
        cout << "Number of active hosts: " << networkClients.size();
        cout << "\tNumber of unique users: " << unique_users.size() << endl;
        cout << "Chance of users being home: " << usersAtHome << endl;

        heatingState = 0;
        if((usersAtHome > 0.5 && averageTemperature < configuredTemperature) || averageTemperature < configuredTemperature -5){
            // If there are people home or we expect them to be home,
            // switch on heating if below configured temperature.
            // If no-one is home, allow it to get 5 degrees colder.
            heatingState = 1;
        }

        if(heatingState == 1 && userInput > 0){
            // We seem to have clicked the userInput button after the heating came on anyway.
            ClearUserInput();
            cout << "Strange user input. heatingState: 1  userInput: 1" << endl;
        } else if(heatingState == 0 && userInput < 0){
            // We seem to have clicked the userInput button after the heating switched off anyway.
            ClearUserInput();
            cout << "Strange user input. heatingState: 0  userInput: -1" << endl;
        }

        if(heatingState == 0 && userInput > 0){
            // Heating configured to be off but user has switched on.
            userOveride = 1;
        } else if(heatingState == 1 && userInput < 0){
            // Heating configured to be on but user has switched off.
            userOveride = 0;
        } else {
            userOveride = heatingState;
        }

        if(heatingState != userOveride){
            if(userOveride == 0){
                Cyclic::lookup("temp_setting_1_week")->store(mins, configuredTemperature -1);
            } else {
                Cyclic::lookup("temp_setting_1_week")->store(mins, configuredTemperature +1);
            }
            heatingState = userOveride;
        } else {
            Cyclic::lookup("temp_setting_1_week")->store(mins, configuredTemperature);
        }

        SwitchHeating(heatingState);

        cout << "heatingState: " << heatingState << endl;
        cout << endl;

    }

    cout << "Closing houseKeeping_thread." << endl;
}

int main(int argc, char **argv){
    if (argc != 2 && argc != 3) {
        printf("%s PORT [DATA_PATH]\n", argv[0]);
        return 1;
    }

    if (argc == 3){
        data_path = argv[2];
    }
    string str_data_path = data_path;


    Cyclic store_whos_home_1_week("whos_home_1_week", 30, MINS_IN_WEEK, 10, 0, str_data_path, &fileUtilsInstance);
    Cyclic store_temp_setting_1_week("temp_setting_1_week", 15, MINS_IN_WEEK, 1, 20, str_data_path, &fileUtilsInstance);

    Cyclic::lookup("whos_home_1_week")->restoreFromDisk();
    Cyclic::lookup("temp_setting_1_week")->restoreFromDisk();

    cout << "allCyclic.size: " << Cyclic::allCyclic.size() << endl;

    // Read config from disk.
    string unused_buffer;
    map<string, string> unused_arguments;
    CallbackRead(&unused_buffer, &unused_arguments);

    thread houseKeeping_thread(houseKeeping);

    http_server daemon(atoi(argv[1]), &authInstance);
    daemon.register_path("/save", "GET", &CallbackSave);
    daemon.register_path("/read", "GET", &CallbackRead);
    daemon.register_path("/data", "GET", &CallbackGetData);
    daemon.register_path("/put", "POST", &CallbackPost);
    daemon.register_path("/clientput", "POST", &CallbackPost);
    daemon.register_path("/whoin", "GET", &store_whos_home_1_week);
    daemon.register_path("/cyclicDB_temp_setting_1_week", "GET", &store_temp_setting_1_week);
    daemon.register_path("/cyclicDB_whos_home_1_week", "GET", &store_whos_home_1_week);

    ws_server ws_daemon(atoi(argv[1]) +1, &authInstance);
    ws_daemon.register_path("/data", "GET", &CallbackGetData);
    ws_daemon.register_path("/whoin", "GET", &store_whos_home_1_week);
    ws_daemon.register_path("/cyclicDB_temp_setting_1_week", "GET", &store_temp_setting_1_week);
    ws_daemon.register_path("/cyclicDB_whos_home_1_week", "GET", &store_whos_home_1_week);

    authInstance.populateUsers("./", "autherisedusers");

    (void)getchar();

    // Tell threads to quit and wait for that to happen.    
    run = 0;
    houseKeeping_thread.join();

    return 0;
}

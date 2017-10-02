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
#include <curl/curl.h>

#define MIN_TEMP -55    // degrees centegrade
#define MAX_TEMP 125    // degrees centegrade

#define READAHEAD 30    // control temperature acording to how it is set this far in the future.

#define CONFIGFILENAME "homeautod.cfg"
#define USERCACHEFILENAME "user.cache"
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

string data_path = "/var/lib/homeautod/";
string port = "55555";

StatWrapperInterface statWrapper;
OFstreamWrapper ofStreamWrapper;
IFstreamWrapper ifStreamWrapper;

FileUtils fileUtilsInstance(&statWrapper, &ofStreamWrapper, &ifStreamWrapper);

Auth authInstance(&fileUtilsInstance);

int minutesIntoWeek(void);  // typedef

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
    if(fileUtilsInstance.writable(data_path, CONFIGFILENAME) != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    // Path exists and is writable.
    string buffer;
    map<string, string> arguments_to_save;
    arguments_to_save["type"] = "configuration";
    arguments_to_save["pretty"] = "1";
    CallbackGetData(&buffer, &arguments_to_save);

    fileUtilsInstance._rename(data_path + CONFIGFILENAME, data_path + CONFIGFILENAME + ".back");
    fileUtilsInstance.write(data_path, CONFIGFILENAME, buffer);


    // Now let's do the same for the cache of AppEngine user IDs.
    if(fileUtilsInstance.writable(data_path, USERCACHEFILENAME) != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    // Path exists and is writable.
    arguments_to_save["type"] = "user";
    arguments_to_save["pretty"] = "1";
    CallbackGetData(&buffer, &arguments_to_save);

    fileUtilsInstance._rename(data_path + USERCACHEFILENAME, data_path + USERCACHEFILENAME + ".back");
    fileUtilsInstance.write(data_path, USERCACHEFILENAME, buffer);
    
    *p_buffer = "ok";
    return 0;
}

/* Wrapper around CallbackSave() that we can call with no arguments.*/
int SaveConfig(void){
    std::string buffer;
    map<string, string> unused_arguments;
    if(CallbackSave(&buffer, &unused_arguments)){
        cout << buffer << endl;
        return 1;
    }

    cout << "Configuration saved." << endl;
    return 0;
}

int CallbackTime(std::string* p_buffer, map<string, string>* p_arguments){
    *p_buffer = "[{\"type\":\"time\",\"data\":{\"key\":\"time\",\"label\":\"time\",\"val\":\"" + std::to_string(minutesIntoWeek()) + "\"}}]";
    return 0;
}

/* Read saved configuration to disk cache. */
int CallbackRead(std::string* p_buffer, map<string, string>* p_arguments){
    if(fileUtilsInstance.writable(data_path, CONFIGFILENAME) != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    string line, buffer;
    do{
        fileUtilsInstance.readLine(data_path, CONFIGFILENAME, &line);
        buffer += line + "\n";
    }while(line != "");

    map<string, string> unused_map;
    if(CallbackPost(&buffer, &unused_map)){
        *p_buffer = "Error reading cached config.";
        return 1;
    }

    // Now let's do the same for the cache of AppEngine user IDs.
    line = "";
    buffer = "";
    if(fileUtilsInstance.writable(data_path, USERCACHEFILENAME) != 1){
        *p_buffer = "Cannot write to " + data_path + ".";
        return 1;
    }

    do{
        fileUtilsInstance.readLine(data_path, USERCACHEFILENAME, &line);
        buffer += line + "\n";
    }while(line != "");

    if(CallbackPost(&buffer, &unused_map)){
        *p_buffer = "Error reading cached user info.";
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
    // Switch hardware
    static CURL* curl = curl_easy_init();
    static CURLcode res;

    if(state){
        curl_easy_setopt(curl, CURLOPT_URL, "http://192.168.192.8/cgi-bin/relay.cgi?on");
    } else {
        curl_easy_setopt(curl, CURLOPT_URL, "http://192.168.192.8/cgi-bin/relay.cgi?off");
    }
    res = curl_easy_perform(curl);
    if(res != CURLE_OK){
        cout << "Switch failed. " << curl_easy_strerror(res) << endl;
    }

    // Update DB
    string jsonText = "[{\"type\":\"output\",\"data\":{\"key\":\"heatOnOff\",\"label\":\"output\",\"val\":\"" + to_string(state) + "\"}}]";
    Document document;
    document.Parse(jsonText.c_str());
    return JSONtoInternal(&document);
}

int ClearUserInputOnOff(void){
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

    // Vacation mode flag.
    int vacation;

    // Tempary holder for user desision when it disagrees with configured value.
    int userOveride;

    // Whether heating is switched on or off.
    int heatingState = 0;

    // Keep a running total of how much of a cycle heatingState was on for.
    float totalHeatingState = 0;
    int sampleNumber = 0;

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

        // Calculate average temperature of all temperature sensors.
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
        for(auto it = userInputValues.begin(); it != userInputValues.end(); ++it){
            cout << it->first << "," << it->second << endl;
            if(it->first == "heatOnOff"){
                userInput = it->second;
            }
        }
        if(!userInput){
            // Storing a null userInput value means there is less work to do on the client, checking time stamps, etc.
            ClearUserInputOnOff();
        }

        GetData("userInput", 0, "", "", &userInputValues);
        vacation = 0;
        for(auto it = userInputValues.begin(); it != userInputValues.end(); ++it){
            if(it->first == "vacation"){
                vacation = it->second;
            }
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
            if(userId != "none" && userId != "" && networkClients.count(macAddr) > 0 && count(unique_users.begin(), unique_users.end(), userId) == 0){
                cout << macAddr << " " << userId << endl;
                unique_users.push_back(userId);
            }
        }

        Cyclic::lookup("whos_home_1_week")->store(mins, (unique_users.size() > 0));

        configuredTemperature = Cyclic::lookup("temp_setting_1_week")->read(mins);

        if(unique_users.size() > 0){
            usersAtHome = 1;
        } else {
            usersAtHome = Cyclic::lookup("whos_home_1_week")->read(mins + READAHEAD);
        }
        
        cout << "Minutes into week (mins): " << mins << endl;
        cout << "averageTemperature: " << averageTemperature << "\t" << activeTemperatureSensors << endl;
        cout << "userInput: " << userInput << endl;
        cout << "configuredTemperature: " << configuredTemperature << endl;
        cout << "Number of active hosts: " << networkClients.size();
        cout << "\tNumber of unique users: " << unique_users.size() << endl;
        cout << "Chance of users being home: " << usersAtHome << endl;

        heatingState = 0;
        if(vacation){
            cout << "On vcation." << endl;
            if(averageTemperature < 7 || userInput > 0){
                cout << "Heating on." << endl;
                heatingState = 1;
            }
        } else {
            if((usersAtHome > 0.5 && averageTemperature < configuredTemperature) || averageTemperature < configuredTemperature -5){
                // If there are people home or we expect them to be home,
                // switch on heating if below configured temperature.
                // If no-one is home, allow it to get 5 degrees colder.
                heatingState = 1;
            }

            if(heatingState == 1 && userInput > 0){
                // We seem to have clicked the userInput button after the heating came on anyway.
                ClearUserInputOnOff();
                cout << "Strange user input. heatingState: 1  userInput: 1" << endl;
            } else if(heatingState == 0 && userInput < 0){
                // We seem to have clicked the userInput button after the heating switched off anyway.
                ClearUserInputOnOff();
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
                    Cyclic::lookup("temp_setting_1_week")->store(mins, configuredTemperature -0.25);
                } else {
                    Cyclic::lookup("temp_setting_1_week")->store(mins, configuredTemperature +0.25);
                }
                heatingState = userOveride;
            } else {
                Cyclic::lookup("temp_setting_1_week")->store(mins, configuredTemperature);
            }
        }

        SwitchHeating(heatingState);

        cout << "heatingState: " << heatingState << endl;
        cout << endl;


        map<string,string> newConfiguration;
        GetData("configuration", 31, "", "", &newConfiguration);
        if(newConfiguration.size()){
            // elements younger than last save exist.
            SaveConfig();
        }

        // Store average temperature across all probes.
        Cyclic::lookup("average_temp_1_week")->store(mins, averageTemperature);

        // Store whether heating was on or off.
        if(sampleNumber >= 30){
            sampleNumber = 0;
            totalHeatingState = 0;
        }
        totalHeatingState += heatingState;
        ++sampleNumber;
        Cyclic::lookup("heating_state_1_week")->store(mins, totalHeatingState / sampleNumber);

        // Store whether someone is actually at home (or heating has been triggered remotely).
        Cyclic::lookup("occupied_1_week")->store(mins, unique_users.size() || (userInput > 0));
    }

    cout << "Closing houseKeeping_thread." << endl;
}

static int exit_flag = 0;
// Signal handler
static void hdl(int sig){
    exit_flag = sig;
}

int main(int argc, char **argv){
    // Parse command line arguments.
    if (argc < 2 && argc > 4) {
        printf("%s PORT [DATA_PATH]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    if (argc >= 2){
        port = argv[1];
    }
    string str_port = port;

    if (argc >= 3){
        data_path = argv[2];
    }
    string str_data_path = data_path;

    int runAsDaemon = 1;
    if (argc == 4){
        runAsDaemon = 0;
    }

   
    if(runAsDaemon){ 
        // Now daemonize the process:
        /* Our process ID and Session ID */
        pid_t pid, sid;
        
        /* Fork off the parent process */
        pid = fork();
        if (pid < 0) {
          exit(EXIT_FAILURE);
        }
        /* If we got a good PID, then
           we can exit the parent process. */
        if (pid > 0) {
          exit(EXIT_SUCCESS);
        }

        /* Change the file mode mask */
        umask(0);
                
        /* Open any logs here */        
                
        /* Create a new SID for the child process */
        sid = setsid();
        if (sid < 0) {
          /* Log the failure */
          exit(EXIT_FAILURE);
        }
        

        
        /* Change the current working directory */
        if ((chdir("/")) < 0) {
          /* Log the failure */
          exit(EXIT_FAILURE);
        }
        
        /* Close out the standard file descriptors */
        close(STDIN_FILENO);
        close(STDOUT_FILENO);
        close(STDERR_FILENO);
    }


    // Register signal handler
    struct sigaction act;
 
    memset (&act, '\0', sizeof(act));
    act.sa_handler = &hdl;
    if (sigaction(SIGTERM, &act, NULL) < 0) {
        perror ("sigaction");
        exit(EXIT_FAILURE);
    }


    Cyclic store_average_temp_1_week("average_temp_1_week", 15, MINS_IN_WEEK, 1, 0, str_data_path, &fileUtilsInstance);
    Cyclic store_heating_state_1_week("heating_state_1_week", 15, MINS_IN_WEEK, 1, 0, str_data_path, &fileUtilsInstance);
    Cyclic store_whos_home_1_week("whos_home_1_week", 30, MINS_IN_WEEK, 10, 0, str_data_path, &fileUtilsInstance);
    Cyclic store_temp_setting_1_week("temp_setting_1_week", 15, MINS_IN_WEEK, 1, 20, str_data_path, &fileUtilsInstance);
    Cyclic store_occupied_1_week("occupied_1_week", 15, MINS_IN_WEEK, 1, 0, str_data_path, &fileUtilsInstance);

    Cyclic::lookup("average_temp_1_week")->restoreFromDisk();
    Cyclic::lookup("heating_state_1_week")->restoreFromDisk();
    Cyclic::lookup("whos_home_1_week")->restoreFromDisk();
    Cyclic::lookup("temp_setting_1_week")->restoreFromDisk();
    Cyclic::lookup("occupied_1_week")->restoreFromDisk();

    cout << "allCyclic.size: " << Cyclic::allCyclic.size() << endl;

    // Read config from disk.
    string unused_buffer;
    map<string, string> unused_arguments;
    CallbackRead(&unused_buffer, &unused_arguments);

    thread houseKeeping_thread(houseKeeping);
    
    http_server daemon(atoi(port.c_str()), &authInstance);
    daemon.register_path("/save", "GET", &CallbackSave);
    daemon.register_path("/read", "GET", &CallbackRead);
    daemon.register_path("/data", "GET", &CallbackGetData);
    daemon.register_path("/put", "POST", &CallbackPost);
    daemon.register_path("/clientput", "POST", &CallbackPost);
    daemon.register_path("/whoin", "GET", &store_whos_home_1_week);
    daemon.register_path("/serverTime", "GET", &CallbackTime);
    daemon.register_path("/cyclicDB_temp_setting_1_week", "GET", &store_temp_setting_1_week);
    daemon.register_path("/cyclicDB_whos_home_1_week", "GET", &store_whos_home_1_week);
    daemon.register_path("/cyclicDB_average_temp_1_week", "GET", &store_average_temp_1_week);
    daemon.register_path("/cyclicDB_heating_state_1_week", "GET", &store_heating_state_1_week);
    daemon.register_path("/cyclicDB_occupied_1_week", "GET", &store_occupied_1_week);
    
    ws_server ws_daemon(atoi(port.c_str()) +1, &authInstance);
    ws_daemon.register_path("/data", "GET", &CallbackGetData);
    ws_daemon.register_path("/whoin", "GET", &store_whos_home_1_week);
    ws_daemon.register_path("/serverTime", "GET", &CallbackTime);
    ws_daemon.register_path("/cyclicDB_temp_setting_1_week", "GET", &store_temp_setting_1_week);
    ws_daemon.register_path("/cyclicDB_whos_home_1_week", "GET", &store_whos_home_1_week);
    ws_daemon.register_path("/cyclicDB_average_temp_1_week", "GET", &store_average_temp_1_week);
    ws_daemon.register_path("/cyclicDB_heating_state_1_week", "GET", &store_heating_state_1_week);
    ws_daemon.register_path("/cyclicDB_occupied_1_week", "GET", &store_occupied_1_week);

    authInstance.populateUsers(data_path, "authorisedusers");

    while(!exit_flag){
        sleep(10); /* wait 10 seconds */
    }

    // Tell threads to quit and wait for that to happen.    
    run = 0;
    houseKeeping_thread.join();

    // Save Config to disk.
    SaveConfig();

    cout << "Done." << endl;

    exit(exit_flag);
    //exit(EXIT_SUCCESS);
}

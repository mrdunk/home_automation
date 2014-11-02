#ifndef JSON_H
#define JSON_H

#include "libjson.h"

#include "rapidjson/document.h"
#include "rapidjson/writer.h"
#include "rapidjson/stringbuffer.h"

#include <map>
#include <list>
#include <mutex>
#include <vector>
#include <algorithm>    // std::remove_if

using namespace std;
using namespace rapidjson;

/* [ { 'type': STRING, 
 *     'data': {'host': STRING,
 *              'label': STRING,
 *              'key': STRING,
 *              'value': STRING
 *             }
 *   },
 *   { etc..}
 * ]
 */

/* Contains a single dataPoint received via an http POST.
 * eg:
 *   A type:sensors dataPoint from a remote temperature sensor.
 *   A type:configuration dataPoint from user input on a web interface (or from a backup of such dataPoints on disk.
 * */
struct data_node{
    string type;
    map<string, string> data;
    time_t time;

    bool operator==(const data_node& rhs) const{
        if(type != rhs.type){
            return 0;
        }
        if(data.find("key")->second.compare(rhs.data.find("key")->second) == 0 && data.find("label")->second.compare(rhs.data.find("label")->second) == 0){
            return 1;
        }
        return 0;
    }
};

/* Contains all dataPoints received via an http POST. */
struct s_data_nodes{
    list<struct data_node> container;
    mutex lock_container;

    void push(struct data_node* node);
    vector<struct data_node> lookup(map<string,string>* p_arguments);
};


/*class ParseJSON{
        int(*p_callback)(string type, map<string, string> data);
        void ParseNode(const JSONNode & n);
        void ParseNode(const JSONNode & n, int* p_current_depth, int* p_seen_type, int* p_seen_data, map<string, string>* p_possible_data, string* p_possible_type);
        void RegisterCallback(int(*callback)(string type, map<string, string> data));
    public:
        ParseJSON(const char* json_text, int(*callback)(string type, map<string, string> data));
        int error;
};*/

/* Take JSON and store in internal map. */
int JSONtoInternal(Document* p_JSON_input);

/* Take map<string, string> and use it to poulate a JSON object consistent with the data format to be sent and received by this server.
 * The map<string, string> can be either created manually or sent by an http POST> */
void InternalToJSON(Document* p_JSON_output, map<string, string>* p_arguments);


//int dataFromInternalSave(string type, map<string, string> data);

#endif  // JSON_H

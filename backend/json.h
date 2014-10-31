#ifndef JSON_H
#define JSON_H

//#include "libjson/libjson.h"
#include "libjson.h"
#include <map>

using namespace std;

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

class ParseJSON{
        int(*p_callback)(string type, map<string, string> data);
    public:
        ParseJSON(const char* json_text, int(*callback)(string type, map<string, string> data));
        void ParseNode(const JSONNode & n);
        void ParseNode(const JSONNode & n, int* p_current_depth, int* p_seen_type, int* p_seen_data, map<string, string>* p_possible_data, string* p_possible_type);
        void RegisterCallback(int(*callback)(string type, map<string, string> data));
        int error;
};


#endif  // JSON_H

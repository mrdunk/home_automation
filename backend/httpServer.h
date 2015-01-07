#ifndef HTTPSERVER_H
#define HTTPSERVER_H

extern "C" {
#include <microhttpd.h>
}
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <arpa/inet.h>

#include <vector>
#include <map>
#include <iostream>   // std::cout
#include <string>     // std::string, std::to_string
#include <mutex>

#include "rapidjson/document.h"
#include "fileUtils.h"
#include "auth.h"

#define PAGE "<html><head><title>libmicrohttpd</title>"\
             "</head><body>no callback</body></html>"

#define GET             0
#define POST            1
#define POSTBUFFERSIZE  1024

using namespace std;
using namespace rapidjson;

enum http_callback_type{
    _function,
    _class
};

struct connection_info_struct
{
  int connectiontype;
  char *answerstring;
  struct MHD_PostProcessor *postprocessor;
  bool authorised;
};

struct http_path{
    char path[48];
    char method[5];
    http_callback_type type;
    //int (*callback)(std::string*, map<string, string>*);
    void* callback;
};

/* Make classes we want to use in callbacks inherit from this. */
class HttpCallback{
    public:
        virtual int textOutput(std::string* p_buffer, map<string, string>* p_arguments){ return 0;}
};

class http_server{
        static int post_iterator(void *cls,
            enum MHD_ValueKind kind,
            const char *key,              
            const char *filename,                        
            const char *content_type,                                   
            const char *transfer_encoding,                                             
            const char *data, uint64_t off, size_t size);

        static string connection_to_IP(struct MHD_Connection * connection);

        /* Contains all http_path objects we expect to match incoming requests. */
        static vector<http_path> paths;

        static map<string, string> arguments;

        /* Instance of Auth class for verifying valid keys with incoming data. */
        static Auth* p_authInstance;

        struct MHD_Daemon *mhd_daemon;

        /* Called whenever server gets a request.
         *
         * Args:
         *  
         *  */
        static int ahc_response(void* cls, struct MHD_Connection* connection,
                                const char* url, const char* method, 
                                const char* version,
                                const char* upload_data, size_t* upload_data_size,
                                void** ptr);

        /* Called when a client first makes a TCP connection to the server. */
        static int on_client_connect(void* cls, const struct sockaddr* addr,
                                     socklen_t address_len);

        static int send_page(struct MHD_Connection *connection, const char *page, unsigned int status_code);

        static void post_request_completed (void *cls, struct MHD_Connection *connection, void **con_cls,
                                                                    enum MHD_RequestTerminationCode toe);

        static int SaveArguments(void *cls, enum MHD_ValueKind kind, 
                                 const char *key, const char *value);
        static int ParseHeaders(void *cls, enum MHD_ValueKind kind, const char *key, const char *value);

        static mutex mutex_response;

        // Buffer incoming data from POST request.
        static string received_so_far;
    public:
        http_server(unsigned short, Auth* _p_authInstance);
        ~http_server(void);

        /* Register the Path and Method (GET,POST,etc) we expect and a  
         * callback function to execute when we get them.
         *
         * Args:
         *  const char* path:   Path in incoming URL.
         *  const char* method: GET or POST.
         *  int(*callback)(char*): Callback function that populates char*. */
        void register_path(const char* path, const char* method, 
                           int(*callback)(std::string*, map<string, string>*));

        /* Register the Path and Method (GET,POST,etc) we expect and a  
         * callback class instance. This class should inheret from class HttpCallback
         * and the HttpCallback::textOutput function should provide the html response. */
        void register_path(const char* path, const char* method,
                HttpCallback* callback);

        static std::string page_content;
};


#endif  // HTTPSERVER_H

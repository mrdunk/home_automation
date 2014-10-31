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


#define PAGE "<html><head><title>libmicrohttpd</title>"\
             "</head><body>no callback</body></html>"

using namespace std;


struct http_path{
    char path[48];
    char method[5];
    int (*callback)(std::string*, map<string, string>*);
};

class http_server{
        /* Contains all http_path objects we expect to match incoming requests. */
        vector<http_path> paths;

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

        /* Called whenever a valid GET is received. */
        static int ahc_response_get(void*, struct MHD_Connection*,
                int(*callback)(std::string*, map<string, string>*));

        /* Called whenever a valid POST is received. */
        static int ahc_response_post(void*, struct MHD_Connection*,
                int(*callback)(std::string*, map<string, string>*), const char*, size_t*, void**);

        /* Called when a client first makes a TCP connection to the server. */
        static int on_client_connect(void* cls, const struct sockaddr* addr,
                                     socklen_t address_len);

        static int send_page(struct MHD_Connection* connection, const char* page);

        static void post_request_completed (void *cls, struct MHD_Connection *connection, void **con_cls,
                                                                    enum MHD_RequestTerminationCode toe);

        static int SaveArguments(void *cls, enum MHD_ValueKind kind, 
                                 const char *key, const char *value);
        static int ParseHeaders(void *cls, enum MHD_ValueKind kind, const char *key, const char *value);

        static mutex mutex_response;

        // Buffer incoming data from POST request.
        static string received_so_far;
    public:
        http_server(unsigned short);
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

        static std::string page_content;
};


#endif  // HTTPSERVER_H

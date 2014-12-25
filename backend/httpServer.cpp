#include "httpServer.h"


http_server::http_server(unsigned short port, Auth* _p_authInstance){
    cout << "Object is being created" << endl;

    p_authInstance = _p_authInstance;
    mhd_daemon = MHD_start_daemon(MHD_USE_SELECT_INTERNALLY,
    //mhd_daemon = MHD_start_daemon(MHD_USE_THREAD_PER_CONNECTION,
            port,
            on_client_connect,
            NULL,
            &ahc_response,
            &paths,
            MHD_OPTION_NOTIFY_COMPLETED,
            &post_request_completed, NULL,
            MHD_OPTION_END);
}

std::string http_server::page_content;
mutex http_server::mutex_response;
string http_server::received_so_far;

Auth* http_server::p_authInstance;
string http_server::address_incoming;
map<string, string> http_server::arguments;

http_server::~http_server(void){
    cout << "Object is being destroyed" << endl;
    MHD_stop_daemon(mhd_daemon);
}

int http_server::ahc_response(void * cls,
        struct MHD_Connection * connection,
        const char * url,
        const char * method,
        const char * version,
        const char * upload_data,
        size_t * upload_data_size,
        void ** ptr) {

    vector<http_path> _paths = *(vector<http_path>*)cls;
    int retcode = MHD_NO;
    for(std::vector<http_path>::iterator it = _paths.begin(); it != _paths.end(); ++it){
        if(strcmp(url, it->path) == 0 && strcmp(method, it->method) == 0){
            //cout << "matching path:  " << url << endl;
            mutex_response.lock();
            if(strcmp(method, "GET") == 0){
                retcode = ahc_response_get(cls, connection, &(*it));
            } else if(strcmp(method, "POST") == 0){
                retcode = ahc_response_post(cls, connection, &(*it),
                        upload_data, upload_data_size, ptr);
            }
            mutex_response.unlock();
        }
    }
    return retcode;
}

void http_server::post_request_completed(void *cls, struct MHD_Connection *connection, void **con_cls,
                                                    enum MHD_RequestTerminationCode toe){
    int *con_info = (int *)*con_cls;

    if(NULL == con_info){
        return;
    }
    //cout << "http_server::post_request_completed" << endl;

    free(con_info);
    *con_cls = NULL;
}


int http_server::send_page(struct MHD_Connection* connection, unsigned int status_code, const char* page){
    struct MHD_Response* response = MHD_create_response_from_data(strlen(page), (void*)page, MHD_NO, MHD_NO);
    //MHD_add_response_header(response, "Access-Control-Allow-Origin", "http://192.168.192.254:3000");
    MHD_add_response_header(response, "Access-Control-Allow-Origin", "http://home-automation-7.appspot.com");
    MHD_add_response_header(response, "Access-Control-Allow-Credentials", "true");

    int ret = MHD_queue_response(connection, status_code, response);
    MHD_destroy_response(response);

    return ret;
}

int http_server::ahc_response_get(void* cls, struct MHD_Connection* connection, struct http_path* path){

    arguments.clear();
    MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, SaveArguments, &arguments);
    //MHD_get_connection_values(connection, MHD_HEADER_KIND, ParseHeaders, NULL);
    //MHD_get_connection_values(connection, MHD_RESPONSE_HEADER_KIND, ParseHeaders, NULL);

    if(path->callback){
        if(path->type == _function){
            // Callback pointer is a function pointer.
            ((int (*)(string*, map<string, string>*))(path->callback))(&page_content, &arguments);
        } else {
            // Callback pointer is a class instance pointer.
            ((HttpCallback*)path->callback)->textOutput(&page_content, &arguments);
        }

        int ret = send_page(connection, MHD_HTTP_OK, (const char*)page_content.c_str());
        return ret;
    }

    return MHD_NO;
}


int http_server::ahc_response_post(void* cls, struct MHD_Connection* connection, struct http_path* path,
                                   const char * upload_data, size_t * upload_data_size,
                                   void ** ptr){
    if(*ptr == NULL){
        int* con_info = new int;
        *ptr = (void*)con_info;

        received_so_far = "";
        return MHD_YES;
    }

    int *con_info = (int*)*ptr;

    if(*upload_data_size != 0){
        // Receiving data. Buffer it.
        cout << "POST size: " << *upload_data_size  << "\tpath: " << path->path << endl;

        *con_info = 3;
        char* buffer = (char*)malloc(*upload_data_size +1);
        if(buffer == NULL){ return MHD_NO; }
        buffer[*upload_data_size] = '\0';
        strncpy(buffer, upload_data, *upload_data_size);

        received_so_far += buffer;

        free(buffer);

        *upload_data_size = 0;

        return MHD_YES;
    } else if(*con_info == 3){
        // Have all data so do something with it.
       
        map<string, string> arguments; 
        string bufferAddress = "";
        string bufferMask = "";
        string unathenticatedUser = "";
        bool autherised = 0;
        if(IsAddressOnLocal(address_incoming, &bufferAddress, &bufferMask)){
            // Incoming data is from local subnet.
            autherised = 1;
        } else {
            string key = "";
            auto it_arg = arguments.find("key");
            if (it_arg != arguments.end()) {
                key = it_arg->second;
            };
            if(p_authInstance->decrypt(key, &unathenticatedUser) != ""){
                // Incoming data contains valid key.
                autherised = 1;
            }
        }
        unsigned int status_code;
        if(autherised){
            if(path->type == _function){
                // Callback pointer is a function pointer.
                if(((int (*)(string*, map<string, string>*))(path->callback))(&received_so_far, &arguments) == 0){
                    status_code = MHD_HTTP_OK;
                } else {
                    status_code = MHD_HTTP_BAD_REQUEST;
                }
            } else {
                // Callback pointer is a class instance pointer.
                if(((HttpCallback*)path->callback)->textOutput(&received_so_far, &arguments) == 0){
                    status_code = MHD_HTTP_OK;
                } else {
                    status_code = MHD_HTTP_BAD_REQUEST;
                }
            }
        } else {
            status_code = MHD_HTTP_FORBIDDEN;
            arguments["error"] = "yes";
            arguments["description"] = "Invalid network " + address_incoming + " or user " + unathenticatedUser + ".";
            cout << arguments["description"] << endl;
        }

        if(arguments["error"] == "yes"){
            return send_page(connection, status_code, "error");
        }
        return send_page(connection, status_code, "ok");
    }
    return send_page(connection, MHD_HTTP_INTERNAL_SERVER_ERROR, "<html><body>This doesn't seem to be right.</body></html>"); 
}

/* Called when a client first makes a TCP connection to the server. */
int http_server::on_client_connect(void* cls, const struct sockaddr* addr, socklen_t address_len){
    char buf[INET6_ADDRSTRLEN];
    //printf("Incoming IP: %s\n", inet_ntop(addr->sa_family, addr->sa_data + 2, buf, INET6_ADDRSTRLEN));

    address_incoming = inet_ntop(addr->sa_family, addr->sa_data + 2, buf, INET6_ADDRSTRLEN);

    return MHD_YES;
}

/* Register the Path and Method (GET,POST,etc) we expect and a
 * callback function to execute when we get them. */
void http_server::register_path(const char* path, const char* method,
                                int(*callback)(std::string*, map<string, string>*)){
    struct http_path new_path;

    strncpy(new_path.path, path, 48);
    strncpy(new_path.method, method, 5);
    new_path.type = _function;
    new_path.callback = (void*)callback;

    paths.push_back(new_path);
}

void http_server::register_path(const char* path, const char* method, HttpCallback* callback){
    struct http_path new_path;

    strncpy(new_path.path, path, 48);
    strncpy(new_path.method, method, 5);
    new_path.type = _class;
    new_path.callback = callback;

    paths.push_back(new_path);
}

int http_server::SaveArguments(void *cls, enum MHD_ValueKind kind, const char *key, const char *value){
    if(*key && value && *value){
        multimap<string, string>* p_arguments = (multimap<string, string>*)cls;
        p_arguments->insert(std::pair<string, string>(key, value));
    }
    return MHD_YES;
}

int http_server::ParseHeaders(void *cls, enum MHD_ValueKind kind, const char *key, const char *value){
    cout << "Parse Headers: ";
    if(*key){
        cout << key;
    }
    if(value && *value){
        cout << "\t" << value;
    }
    cout << endl;
    return MHD_YES;
}

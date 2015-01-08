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
            NULL,
            MHD_OPTION_NOTIFY_COMPLETED,
            &post_request_completed, NULL,
            MHD_OPTION_END);
}

std::string http_server::page_content;
mutex http_server::mutex_response;
string http_server::received_so_far;

Auth* http_server::p_authInstance;
map<string, string> http_server::arguments;

vector<http_path> http_server::paths;

http_server::~http_server(void){
    cout << "Object is being destroyed" << endl;
    MHD_stop_daemon(mhd_daemon);
}

const char* errorpage="<html><body>This doesn't seem to be right.</body></html>";

string http_server::connection_to_IP(struct MHD_Connection * connection){
    string retVal;
    struct sockaddr *so;
    so = MHD_get_connection_info (connection, MHD_CONNECTION_INFO_CLIENT_ADDRESS)->client_addr;
    retVal = inet_ntoa(((sockaddr_in *)so)->sin_addr);

    return retVal;
}

int http_server::ahc_response(void * cls,
        struct MHD_Connection * connection,
        const char * url,
        const char * method,
        const char * version,
        const char * upload_data,
        size_t * upload_data_size,
        void **con_cls) {

    unsigned int status_code;
    bool autherised;

    struct http_path path_callback;
    path_callback.path[0] = '\0';
    for(std::vector<http_path>::iterator it = paths.begin(); it != paths.end(); ++it){
        if(strcmp(url, it->path) == 0 && strcmp(method, it->method) == 0){
            //cout << "matching path:  " << url << "\t" << method << endl;
            path_callback = *it;
        }
    }
    if(strcmp(path_callback.path, "") == 0){
        //cout << "No path registerd for: " << url << "\t" << method << endl;
        return MHD_NO;
    }

    string address_incoming = connection_to_IP(connection);

    if(NULL == *con_cls){
        struct connection_info_struct *con_info;


        con_info = (struct connection_info_struct *)malloc(sizeof (struct connection_info_struct));
        if (NULL == con_info){
            return MHD_NO;
        }
        con_info->answerstring = NULL;
        con_info->authorised = 0;



        arguments.clear();
        MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, SaveArguments, &arguments);

        string bufferAddress = "";
        string bufferMask = "";
        string unathenticatedUser = "";
        if(IsAddressOnLocal(address_incoming, &bufferAddress, &bufferMask)){
            // Incoming data is from local subnet.
            //cout << "  ## authenticated with NW address: " << address_incoming << endl;
            con_info->authorised = 1;
        } else {
            string key = "";
            auto it_arg = arguments.find("key");
            if (it_arg != arguments.end()) {
                key = it_arg->second;
            };
            if(p_authInstance->decrypt(key, &unathenticatedUser) != ""){
                // Incoming data contains valid key.
                //cout << "  ## authenticated with key: " << key << endl;
                con_info->authorised = 1;
            }
        }



        if(0 == strcmp(method, "POST")){
            //cout << "New POST.\t"  << url << "\t" << method << "\t" << address_incoming << endl;
            received_so_far = "";
            con_info->postprocessor = MHD_create_post_processor(connection, POSTBUFFERSIZE,
                                                                &post_iterator, (void *) con_info);

            if(NULL == con_info->postprocessor){
                free (con_info);
                return MHD_NO;
            }

            con_info->connectiontype = POST;
        }
        else{
            //cout << "New GET.\t"  << url << "\t" << method << "\t" << address_incoming << endl;
            con_info->connectiontype = GET;
        }

        *con_cls = (void *) con_info;

        return MHD_YES;
    }

    // Now tidy up and exit if not autherised.
    struct connection_info_struct *con_info = (struct connection_info_struct *)*con_cls;
    if(con_info->authorised == 0){
        if(0 == strcmp(method, "POST") && *upload_data_size != 0){
            // Listen to rest of POST request but do nothing with it.
            MHD_post_process(con_info->postprocessor, upload_data, *upload_data_size);
            *upload_data_size = 0;
            return MHD_YES;
        }
        //cout << "...bouncing..." << endl;
        status_code = MHD_HTTP_FORBIDDEN;
        return send_page(connection, "Not authorised.", status_code);
    }


    if(0 == strcmp(method, "GET")){
        cout << "New " << method << "\t" << url << "\t" << address_incoming << endl;

        MHD_get_connection_values(connection, MHD_GET_ARGUMENT_KIND, SaveArguments, &arguments);
        if(path_callback.callback){
            if(path_callback.type == _function){
                // Callback pointer is a function pointer.
                ((int (*)(string*, map<string, string>*))(path_callback.callback))(
                    &page_content, &arguments);
            } else {
                // Callback pointer is a class instance pointer.
                ((HttpCallback*)path_callback.callback)->textOutput(&page_content, &arguments);
            }
        }

        return send_page(connection, page_content.c_str(), MHD_HTTP_OK);
    }

    if (0 == strcmp(method, "POST")){
        //struct connection_info_struct *con_info = (struct connection_info_struct *)*con_cls;

        if (*upload_data_size != 0){
            // Data received.
            MHD_post_process(con_info->postprocessor, upload_data, *upload_data_size);


            char* buffer = (char*)malloc(*upload_data_size +1);
            if(buffer == NULL){ return MHD_NO; }
            buffer[*upload_data_size] = '\0';
            strncpy(buffer, upload_data, *upload_data_size);

            received_so_far += buffer;

            free(buffer);

            *upload_data_size = 0;
            return MHD_YES;
        } else {
            // Have all data.
            cout << "New " << method << "\t" << url << "\t" << address_incoming << endl;
            //cout << received_so_far << endl;

            autherised = 1;
            if(autherised){
                if(path_callback.type == _function){
                    // Callback pointer is a function pointer.
                    if(((int (*)(string*, map<string, string>*))(path_callback.callback))(
                                &received_so_far, &arguments) == 0){
                        status_code = MHD_HTTP_OK;
                    } else {
                        status_code = MHD_HTTP_BAD_REQUEST;
                    }
                } else {
                    // Callback pointer is a class instance pointer.
                    if(((HttpCallback*)path_callback.callback)->textOutput(
                                &received_so_far, &arguments) == 0){
                        status_code = MHD_HTTP_OK;
                    } else {
                        status_code = MHD_HTTP_BAD_REQUEST;
                    }
                }
            } else {
                status_code = MHD_HTTP_FORBIDDEN;
                //arguments["error"] = "yes";
                //arguments["description"] = "Invalid network " + address_incoming + 
                //    " or user " + unathenticatedUser + ".";
            }

            return send_page(connection, "ok", status_code);
        }
    }

    return send_page(connection, errorpage, MHD_HTTP_INTERNAL_SERVER_ERROR);
}

void http_server::post_request_completed(void *cls, struct MHD_Connection *connection, void **con_cls,
        enum MHD_RequestTerminationCode toe){

  struct connection_info_struct *con_info = (struct connection_info_struct*)*con_cls;

  if (NULL == con_info){
    return;
  }

  if(con_info->connectiontype == POST){
      MHD_destroy_post_processor (con_info->postprocessor);
      if (con_info->answerstring){
        free(con_info->answerstring);
      }
  }

  free(con_info);
  *con_cls = NULL; 
}


int http_server::send_page(struct MHD_Connection *connection, const char *page, unsigned int status_code){
  int ret;
  struct MHD_Response *response;


  response = MHD_create_response_from_buffer(strlen(page), (void *)page, MHD_RESPMEM_PERSISTENT);
  if (!response){
    return MHD_NO;
  }

  MHD_add_response_header(response, "Access-Control-Allow-Origin",
          "http://home-automation-7.appspot.com");
  MHD_add_response_header(response, "Access-Control-Allow-Credentials", "true");

  ret = MHD_queue_response(connection, status_code, response);
  MHD_destroy_response (response);

  return ret;
}

int http_server::post_iterator(void *cls,
        enum MHD_ValueKind kind,
        const char *key,
        const char *filename,
        const char *content_type,
        const char *transfer_encoding,
        const char *data, uint64_t off, size_t size)
{
    // Don't know how this works.
    // It isn't getting called
    // but the manual says it's needed.
    cout << "********" << endl;
    return MHD_YES;
}

/* Called when a client first makes a TCP connection to the server. */
int http_server::on_client_connect(void* cls, const struct sockaddr* addr, socklen_t address_len){
    
    //char buf[INET6_ADDRSTRLEN];
    //cout << "### Incoming IP: " << inet_ntop(addr->sa_family, addr->sa_data + 2, buf, INET6_ADDRSTRLEN) << endl;

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
        cout << " . " << key;
    }
    if(value && *value){
        cout << "\t" << value;
    }
    cout << endl;
    return MHD_YES;
}

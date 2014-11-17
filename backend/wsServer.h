#ifndef WSSERVER_H
#define WSSERVER_H


#include <iostream>   // std::cout
#include <thread>
#include <set>
#include <map>
#include <vector>
#include <string>     // std::string, std::to_string

#include <websocketpp/config/asio_no_tls.hpp>
#include <websocketpp/server.hpp>
#include <websocketpp/common/thread.hpp>

#include "httpServer.h"

using namespace std;

string get_path(const string url);
int parse_url(const string url, string* p_path, map<string, string>* p_arguments);

enum ws_callback_type{
    _ws_function,
    _ws_class
};

struct ws_path{
    string path;                // Path of incoming data that matches this ws_path instance.
    string method;              // GET, POST, etc.
    ws_callback_type type;      // One of enum ws_callback_type{}. 
    void* callback;             // A pointer to either a function or class instance.
};



typedef websocketpp::server<websocketpp::config::asio> server;

using websocketpp::connection_hdl;
using websocketpp::lib::placeholders::_1;
using websocketpp::lib::placeholders::_2;
using websocketpp::lib::bind;

class ws_server{
  public:
    string user_agent;
    string url;
    string host_address;
    string origin;

    /* Constructor.
     * 
     * Args: (uint16_t)port:  Network port server should listen on. */
    ws_server(uint16_t port);

    /* Destructor. */
    ~ws_server();

    /* Register the Path and Method (GET,POST,etc) we expect and a  
     * callback function to execute when we get them.
     *
     * Since WebSockets don't have the same concept of Methods as HTTP,
     * the Method is simply the path when the connection if first made.
     * ("/get", "/post", etc.)
     *
     * Args:
     *  const char* path:   Path in incoming URL.
     *  const char* method: GET or POST.
     *  int(*callback)(char*): Callback function that populates char*. */
    void register_path(string const path, string method, int(*callback)(std::string*, map<string, string>*));

    /* Register the Path and Method (GET,POST,etc) we expect and a  
     * callback class instance. This class should inheret from class HttpCallback
     * and the HttpCallback::textOutput function should provide the html response. */
    void register_path(string const path, string method, HttpCallback* callback);

  private:
    /* Called whenever a new network connection is made to server. 
     * The path section of the URL is taken to indicate whether this connection
     * should be mapped as a GET/POST/etc. 
     * eg. "192.168.192.254:55556/post" would be passed to the do_post() method.*/
    void on_open(connection_hdl hdl);

    /* Called whenever a connection to the server is closed. */
    void on_close(connection_hdl hdl);

    /* Called whenever data arrives on an open connection. */
    void on_message(connection_hdl hdl, server::message_ptr msg); 

    /* Called by on_message() when incoming data is destined for a "GET" target. */
    void do_get(connection_hdl hdl, server::message_ptr msg, string* p_returned_content);

    /* Called by on_message() when incoming data is destined for a "POST" target. */
    void do_post(connection_hdl hdl, server::message_ptr msg, string* p_returned_content);

    vector<ws_path> paths;
    websocketpp::lib::shared_ptr<websocketpp::lib::thread> m_thread;
    typedef std::set<connection_hdl> con_list;

    server m_server;
    con_list m_connections;
};



#endif  // WSSERVER_H

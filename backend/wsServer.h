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

using namespace std;

string get_path(const string url);
int parse_url(const string url, string* p_path, map<string, string>* p_arguments);

enum ws_callback_type{
    _ws_function,
    _ws_class
};

struct ws_path{
    string path;
    ws_callback_type type;
    void* callback;
};



typedef websocketpp::server<websocketpp::config::asio> server;

using websocketpp::connection_hdl;
using websocketpp::lib::placeholders::_1;
using websocketpp::lib::placeholders::_2;
using websocketpp::lib::bind;

class broadcast_server{
  public:
    string user_agent;
    string url;
    string host_address;
    string origin;

    broadcast_server(uint16_t port){
        m_server.clear_access_channels(websocketpp::log::alevel::all);
        m_server.init_asio();

        m_server.set_open_handler(bind(&broadcast_server::on_open,this,::_1));
        m_server.set_close_handler(bind(&broadcast_server::on_close,this,::_1));
        m_server.set_message_handler(bind(&broadcast_server::on_message,this,::_1,::_2));

        m_server.listen(port);

        m_server.start_accept();
        m_thread = websocketpp::lib::make_shared<websocketpp::lib::thread>(&server::run, &m_server);
    }

    ~broadcast_server(){
        cout << "Shutting down ws." << endl;
        m_server.stop();
        m_thread->join();
        cout << "Shut down ws." << endl;
    }

    void on_open(connection_hdl hdl) {
        m_connections.insert(hdl);

        user_agent = m_server.get_user_agent();
        url = m_server.get_con_from_hdl(hdl)->get_resource();
        host_address = m_server.get_con_from_hdl(hdl)->get_host();
        origin = m_server.get_con_from_hdl(hdl)->get_origin();

        cout << "** " << user_agent << endl;
        cout << "** " << url << endl;
        cout << "** " << host_address << endl;
        cout << "** " << origin << endl;
        cout << "** " << m_server.get_con_from_hdl(hdl)->get_uri() << endl;

        string header;  // Set value of header if we want to read it.
        while(m_server.get_con_from_hdl(hdl)->get_request_header(header) != ""){
            cout << "** " << header << endl;
        }

        map<string, string> args;
        string path;
        parse_url(url, &path, &args);
    }

    void on_close(connection_hdl hdl) {
        m_connections.erase(hdl);
    }

    void on_message(connection_hdl hdl, server::message_ptr msg) {
        for (auto it : m_connections) {
            if(it.lock().get() == hdl.lock().get()){

                string const method = get_path(m_server.get_con_from_hdl(hdl)->get_resource());
                string page_content;

                if(method == "/GET" || method == "/get"){
                    do_get(hdl, msg, &page_content);
                } else if(method == "/POST" || method == "/post"){
                    // TODO
                }
                m_server.send(it, page_content, msg->get_opcode());
            }
        }
    }

    void do_get(connection_hdl hdl, server::message_ptr msg, string* returned_content) {
        string path;
        map<string, string> arguments;
        parse_url(msg->get_payload(), &path, &arguments);

        vector<ws_path>::iterator it_path = find_if(paths.begin(), paths.end(), [&path](ws_path const& i){return i.path == path;});
        if(it_path != paths.end()){
            if(it_path->type == _ws_function){
                // Callback pointer is a function pointer.
                ((int (*)(string*, map<string, string>*))(it_path->callback))(returned_content, &arguments);
            } else {
                // Callback pointer is a class instance pointer.
                //((HttpCallback*)path->callback)->textOutput(&page_content, &arguments);
            }
        } else {
            *returned_content = msg->get_payload();
        }
    }

    void register_path(string path, int(*callback)(std::string*, map<string, string>*)){
        vector<ws_path>::iterator it = find_if(paths.begin(), paths.end(), [&path](ws_path const& i){return i.path == path;});
        if(it != paths.end()){
            it->path = path;
            it->type = _ws_function;
            it->callback = (void*)callback;
        } else {
            const struct ws_path tmp_path = { path,
                                              _ws_function,
                                              (void*)callback };
            paths.push_back(tmp_path);
        }
    }


  private:
    vector<ws_path> paths;
    websocketpp::lib::shared_ptr<websocketpp::lib::thread> m_thread;
    typedef std::set<connection_hdl> con_list;

    server m_server;
    con_list m_connections;
};



#endif  // WSSERVER_H

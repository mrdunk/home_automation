#include "wsServer.h"

using namespace std;


string get_path(const string url){
    std::size_t found = url.find_first_of("?");
    if(found == std::string::npos){
        return url;
    } 
    return url.substr(0, found);
}

int parse_url(const string url, string* p_path, map<string, string>* p_arguments){
    string arg_str;
    string chunk;

    std::size_t found = url.find_first_of("?");
    if(found == std::string::npos){
        *p_path = url;
    } else {
        *p_path = url.substr(0, found);
        arg_str = url.substr(found, url.size());

        while(arg_str.size()){
            found = arg_str.find_last_of("&");
            if(found == arg_str.size() -1){
                // This is the last character in the string so just remove it.
                arg_str.pop_back();
            } else {
                if(found == std::string::npos){
                    found = 0;
                }
                chunk = arg_str.substr(found +1, arg_str.size());
                arg_str.erase(found, arg_str.size());

                found = chunk.find_first_of("=");
                if(found == std::string::npos){
                    (*p_arguments)[chunk] = "";
                } else {
                    (*p_arguments)[chunk.substr(0, found)] = chunk.substr(found+1, chunk.size());
                }
            }
        }
    }
    //cout << "path:    " << *p_path << endl;
    //cout << "arg_str: " << arg_str << endl;
    //for (auto& x: *p_arguments) {
    //    cout << x.first << ": " << x.second << '\n';
    //}
    return 0;
}

ws_server::ws_server(uint16_t port, Auth* _p_authInstance) : p_authInstance(_p_authInstance){ 
    m_server.clear_access_channels(websocketpp::log::alevel::all);
    m_server.init_asio();

    m_server.set_open_handler(bind(&ws_server::on_open,this,::_1));
    m_server.set_close_handler(bind(&ws_server::on_close,this,::_1));
    m_server.set_message_handler(bind(&ws_server::on_message,this,::_1,::_2));

    m_server.listen(port);

    m_server.start_accept();
    m_thread = websocketpp::lib::make_shared<websocketpp::lib::thread>(&server::run, &m_server);
}

ws_server::~ws_server(){
    cout << "Shutting down ws." << endl;
    m_server.stop();
    m_thread->join();
    cout << "Shut down ws." << endl;
}

void ws_server::on_open(connection_hdl hdl) {
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
}

void ws_server::on_close(connection_hdl hdl) {
    m_connections.erase(hdl);
}

void ws_server::on_message(connection_hdl hdl, server::message_ptr msg) {
    for (auto it : m_connections) {
        if(it.lock().get() == hdl.lock().get()){

            map<string, string> arguments;
            string path;
            parse_url(msg->get_payload(), &path, &arguments);

            string const method = get_path(m_server.get_con_from_hdl(hdl)->get_resource());
            string page_content;

            string key = "";
            auto it_arg = arguments.find("key");
            if (it_arg != arguments.end()) { key = it_arg->second; };

            string unathenticatedUser;
            string validUser = p_authInstance->decrypt(key, &unathenticatedUser);
            
            if(validUser == ""){
                cout << "unathenticatedUser: " << unathenticatedUser << endl;
                page_content = "[{\"error\": \"invalid user\", \"name\": \"" + unathenticatedUser + "\"}]";
            } else if(method == "/GET" || method == "/get" || method == "GET" || method == "get"){
                do_get(hdl, msg, &arguments, &path, &page_content);
            } else if(method == "/POST" || method == "/post" || method == "POST" || method == "post"){
                // TODO
            }

            m_server.send(it, page_content, msg->get_opcode());
        }
    }
}

void ws_server::do_get(connection_hdl hdl, server::message_ptr msg, map<string, string>* p_arguments, string* p_path, string* p_returned_content) {
    vector<ws_path>::iterator it_path = find_if(paths.begin(), paths.end(), [p_path](ws_path const& i){return ((i.path == *p_path) && (i.method == "GET"));});
    if(it_path != paths.end()){
        if(it_path->type == _ws_function){
            // Callback pointer is a function pointer.
            ((int (*)(string*, map<string, string>*))(it_path->callback))(p_returned_content, p_arguments);
        } else {
            // Callback pointer is a class instance pointer.
            ((HttpCallback*)it_path->callback)->textOutput(p_returned_content, p_arguments);
        }
    } else {
        *p_returned_content = msg->get_payload();
    }
}

void ws_server::register_path(string const path, string method, int(*callback)(std::string*, map<string, string>*)){
    if(method == "/GET" || method == "GET" || method == "/get" || method == "get"){
        method = "GET";
    }

    vector<ws_path>::iterator it = find_if(paths.begin(), paths.end(), [&path](ws_path const& i){return i.path == path;});
    if(it != paths.end()){
        it->path = path;
        it->method = method;
        it->type = _ws_function;
        it->callback = (void*)callback;
    } else {
        const struct ws_path tmp_path = { path,
            method,
            _ws_function,
            (void*)callback };
        paths.push_back(tmp_path);
    }
}

void ws_server::register_path(string const path, string method, HttpCallback* callback){
    if(method == "/GET" || method == "GET" || method == "/get" || method == "get"){
        method = "GET";
    }

    vector<ws_path>::iterator it = find_if(paths.begin(), paths.end(), [&path](ws_path const& i){return i.path == path;});
    if(it != paths.end()){
        it->path = path;
        it->method = method;
        it->type = _ws_class;
        it->callback = callback;
    } else {
        const struct ws_path tmp_path = { path,
            method,
            _ws_class,
            callback };
        paths.push_back(tmp_path);
    }
}

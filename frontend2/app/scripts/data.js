
var setupConnections = function(){
    serverConnections.registerRequest([[serverFQDN1, "55556", "55555"], [serverFQDN2, "55556", "55555"]], "GET", '/data?data={"label":"userId"}&pretty=1', 2000);
    serverConnections.registerRequest([[serverFQDN1, "55556", "55555"], [serverFQDN2, "55556", "55555"]], "GET", '/data?data={"label":"1wire"}&pretty=1', 2000);
};


function Connections(){
    'use strict';
    this.wsOpen = {};
    this.htmlSucessRate = {};
    this.requestQueue = {};
    this.wsTimeout = 200;     // ms
    this.retryConnectionTimeout = 20000; // ms
}

/* Register a query to be sent to server(s) at specified intervals.
 *
 * Args:
 *   serverList: [[server_FQDN, WebSoccket_port, HTTP_port], [server_FQDN_2, WebSoccket_port_2, HTTP_port_2], [etc]]
 *   method:     GET/POST/etc
 *   path:       Data to be sent. Sent in Path for HTTP-GET. Sent as payload for WS-GET.
 *   timeBetweenRequests: Number of ms to wait before doing this again. */
Connections.prototype.registerRequest = function(serverList, method, path, timeBetweenRequests){
    'use strict';
    console.log("Connections.registerRequest");

    if(path in this.requestQueue){
        clearTimeout(this.requestQueue.path[2]);
    }
    var timer = window.setInterval(function(){this.doRequest(serverList, method, path);}.bind(this), timeBetweenRequests);
    this.requestQueue[path] = [serverList, timeBetweenRequests, timer];
};

Connections.prototype.doRequest = function(serverList, method, path){
    'use strict';
    //console.log("Connections.doRequest(" + serverList + ", " + path + ")");

    if("stop_data_sw" in controlSettings && controlSettings["stop_data_sw"] === 1){
        // Don't try to connect.
        return;
    }

    var retrySoon = 0;
    var ws_sucess = 0;

    var server, address, wsPort, httpPort, url;
    for(server in serverList){
        address = serverList[server][0];
        wsPort = serverList[server][1];
        httpPort = serverList[server][2];

        if("stop_WS_sw" in controlSettings && controlSettings["stop_WS_sw"] === 1){
            // Deliberately cause WS to fail for debugging.
            wsPort = String(parseInt(wsPort) +1);
        }

        if(wsPort){
            url = address + ":" + wsPort;
            if(url in this.wsOpen && this.wsOpen[url][0].websocket !== null && this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.OPEN){
                var openFor = Date.now() - this.wsOpen[url][1];
                console.log("WS already open to " + url + " for " + openFor + " ms.");
                ws_sucess = url;

                // Send the request.
                this.wsOpen[url][0].websocket.send(path);
                break;
            } 
        }
    }

    if(ws_sucess === 0){
        for(server in serverList){
            address = serverList[server][0];
            wsPort = serverList[server][1];
            httpPort = serverList[server][2];

            if("stop_WS_sw" in controlSettings && controlSettings["stop_WS_sw"] === 1){
                // Deliberately cause WS to fail for debugging.
                wsPort = String(parseInt(wsPort) +1);
            }

            if(wsPort){
                url = address + ":" + wsPort;
                if(url in this.wsOpen && this.wsOpen[url][0].websocket !== null &&
                        this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CONNECTING &&
                        Date.now() - this.wsOpen[url][1] < this.wsTimeout){
                    // In the process of connecting to WebSocket.
                    console.log("WS connecting to " + url);

                    retrySoon = 1;
                    break;
                } else if(url in this.wsOpen && this.wsOpen[url][0].websocket !== null && 
                        this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CONNECTING){
                    // TODO don't know if we need this.
                    // Must have timed out while connecting. Treat as failure.
                    console.log("*** FAIL ***", Date.now() - this.wsOpen[url][1], this.wsTimeout);
                } else if((!(url in this.wsOpen)) || this.wsOpen[url][0].websocket === null || 
                            (this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CLOSED &&
                            Date.now() - this.wsOpen[url][1] > this.retryConnectionTimeout)){
                    // Haven't tried this connection before or it's been so long it's worth trying again.
                    console.log("Opening WS to " + url);
                    var websocket = new WS(url);
                    this.wsOpen[url] = [websocket, Date.now()];

                    retrySoon = 1;

                    break;
                }
            }
            //console.log(this.wsOpen);
            if(httpPort){
                url = address + ":" + httpPort;
                console.log("Try HTTP.");
            }
        }
    }
    if(retrySoon == 1){
        // Come back soon to see if we ahve managed to connect.
        window.setTimeout(function(){this.doRequest(serverList, method, path);}.bind(this), this.wsTimeout / 10);
    }
};


function WS(url){
    'use strict';
    this.websocket = null;
    this.url = url;
    this.path = "/get";

    this.initialise();
}

WS.prototype.initialise = function(){
    'use strict';
    if(typeof websocket !== "undefined"){
        if(this.websocket !== null){
            if(this.websocket.readyState === this.websocket.CONNECTING || this.websocket.readyState === this.websocket.CLOSING){
                // Currently in an in-between state so come back later.
                return;
            }
        }
    }
    if(this.websocket === null || this.websocket.readyState === this.websocket.CLOSED){
        // Not open so let's set it up...
        try {
            this.websocket = new WebSocket("ws://" + this.url + this.path);
            this.websocket.onopen = function(evt) { this.onOpen(evt); }.bind(this);
            this.websocket.onclose = function(evt) { this.onClose(evt); }.bind(this);
            this.websocket.onmessage = function(evt) { this.onMessage(evt); }.bind(this);
            this.websocket.onerror = function(evt) { this.onError(evt); }.bind(this);
        }catch(e){
            console.log(e);
        }
    }
};

WS.prototype.onOpen = function(evt){
    'use strict';
    console.log("WS.onOpen", evt);
};

WS.prototype.onClose = function(evt){
    'use strict';
    console.log("WS.onClose", evt);
};

WS.prototype.onMessage = function(evt){
    'use strict';
    console.log("WS.onMessage", evt.data.length);
    //console.log("WS.onMessage", evt.data);
};

WS.prototype.onError = function(evt){
    'use strict';
    console.log("WS.onError", evt.data);

};


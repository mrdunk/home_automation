
var setupConnections = function(){
    serverConnections.registerRequest([[serverFQDN1, "55556", "55555"],
                                       [serverFQDN2, "55556", "55555"]], "test/path", 2000);
};


function Connections(){
    'use strict';
    this.wsOpen = {};
    this.htmlSucessRate = {};
    this.wsSucessRate = {};
    this.requestQueue = {};
    this.timeout = 200;     // ms
    this.retryConnectionTimeout = 20000; // ms
}

Connections.prototype.registerRequest = function(serverList, path, timeBetweenRequests){
    'use strict';
    console.log("Connections.registerRequest");

    if(path in this.requestQueue){
        clearTimeout(this.requestQueue.path[2]);
    }
    var timer = window.setInterval(function(){this.doRequest(serverList, path);}.bind(this), timeBetweenRequests);
    this.requestQueue[path] = [serverList, timeBetweenRequests, timer];
};

Connections.prototype.doRequest = function(serverList, path){
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


        if(wsPort){
            url = address + ":" + wsPort;

            if(url in this.wsOpen && this.wsOpen[url][0] === "yes"){
                var openFor = Date.now() - this.wsOpen[url][1];
                console.log("WS already open to " + url + " for " + openFor + " ms.");
                ws_sucess = url;
                break;
            } 
        }
        //if(httpPort){
        //    url = address + ":" + httpPort;
        //}
    }
    if(ws_sucess === 0){
        for(server in serverList){
            address = serverList[server][0];
            wsPort = serverList[server][1];
            httpPort = serverList[server][2];
            if(wsPort){
                url = address + ":" + wsPort;
console.log(this.wsOpen);
                if(url in this.wsOpen && this.wsOpen[url][0].websocket !== null && this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CONNECTING 
                        && Date.now() - this.wsOpen[url][1] < this.timeout){
                    console.log("WS connecting to " + url);

                    retrySoon = 1;

                    //if(Math.random() < 0.1){
                    //    console.log("*");
                    //    this.wsOpen[url] = ["yes", Date.now()];
                    //}

                    break;
                } else if(url in this.wsOpen && this.wsOpen[url][0].websocket !== null && 
                        this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CONNECTING){
                    // Must have timed out while connecting. Treat as failure.
                    console.log("f", Date.now() - this.wsOpen[url][1], this.timeout);
                    this.wsOpen[url] = ["fail", Date.now()];
                } else if((!(url in this.wsOpen)) || this.wsOpen[url][0].websocket === null || 
                            (this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CLOSED 
                            && Date.now() - this.wsOpen[url][1] > this.retryConnectionTimeout)){
                    // Haven't tried this connection before or it's been so long it's worth trying again.
                    console.log("Opening WS to " + url);
                    //this.wsOpen[url] = ["connecting", Date.now()];
                    var websocket = new WS(url);
                    this.wsOpen[url] = [websocket, Date.now()];

                    retrySoon = 1;

                    break;
                }
            }
        }
    }
    if(retrySoon == 1){
        // Come back soon to see if we ahve managed to connect.
        window.setTimeout(function(){this.doRequest(serverList, path);}.bind(this), this.timeout / 10);
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
    console.log("WS.onMessage", evt);
};

WS.prototype.onError = function(evt){
    'use strict';
    console.log("WS.onError", evt);

};


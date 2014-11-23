

function DataStore(){
    'use strict';
    this.serverConnections = new Connections();
    this.allDataContainer = {};
    this.userDataContainer = {};

    this.setupConnections("users");
    this.setupConnections("temperature");
}

DataStore.prototype.parseIncoming = function(incomingData){
    'use strict';
    var newObj = [];
    try{
        newObj = JSON.parse(incomingData);
        //console.log(newObj);
    }catch(e){
        console.log(e);
        console.log(incomingData);
    }

    var i, j, key, label, val;

    if("ListUsers" in newObj){
        // Unwrap AppEngine format a little bit.
        // TODO ratify the 2 formats.
        newObj = newObj.ListUsers;
    }
    for(i in newObj){
        if("data" in newObj[i] && "key" in newObj[i].data && "label" in newObj[i].data && "val" in newObj[i].data){
            // Data in format from Home server
            key = newObj[i].data.key;
            label = newObj[i].data.label;
            val = newObj[i].data.val;
            if(!(key in this.allDataContainer)){
                this.allDataContainer[key] = {};
            }
            this.allDataContainer[key][label] = [val, Date.now()];
        } else {
            // Presume data from AppEngine.
            // TODO ratify the 2 formats.
            for(j in this.allDataContainer){
                if('userId' in this.allDataContainer[j] && this.allDataContainer[j].userId[0] === newObj[i].id){
                    // Save to the regular DB.
                    this.allDataContainer[j].image = [newObj[i].image, Date.now()];
                    this.allDataContainer[j].displayName = [newObj[i].displayName, Date.now()];

                    // Also populate the userDataContainer DB with all available data.
                    if(!(newObj[i].id in this.userDataContainer)){
                        this.userDataContainer[newObj[i].id] = {};
                    }
                    this.userDataContainer[newObj[i].id].image = this.allDataContainer[j].image[0].url;
                    this.userDataContainer[newObj[i].id].displayName = this.allDataContainer[j].displayName[0];
                    if("description" in this.allDataContainer[j]){
                        if(!("description" in this.userDataContainer[newObj[i].id])){
                            this.userDataContainer[newObj[i].id].description = [this.allDataContainer[j].description[0]];
                        } else if(this.userDataContainer[newObj[i].id].description.indexOf(this.allDataContainer[j].description[0]) < 0){
                            this.userDataContainer[newObj[i].id].description.push(this.allDataContainer[j].description[0]);
                        }
                    }
                    if("net_clients" in this.allDataContainer[j]){
                        if(!("net_clients" in this.userDataContainer[newObj[i].id])){
                            this.userDataContainer[newObj[i].id].net_clients = [this.allDataContainer[j].net_clients[0]];
                        } else if(this.userDataContainer[newObj[i].id].net_clients.indexOf(this.allDataContainer[j].net_clients[0]) < 0){
                            this.userDataContainer[newObj[i].id].net_clients.push(this.allDataContainer[j].net_clients[0]);
                        }
                    }
                    if(!("macAddr" in this.userDataContainer[newObj[i].id])){
                        this.userDataContainer[newObj[i].id].macAddr = [j];
                    } else if(this.userDataContainer[newObj[i].id].macAddr.indexOf(j) < 0){
                        this.userDataContainer[newObj[i].id].macAddr.push(j);
                    }
                }
                
            }
        }

    }
    
    console.log(this.allDataContainer);
    console.log(this.userDataContainer);

    displayTemperature();
    whoshome();
};

DataStore.prototype.setupConnections = function(role){
    'use strict';
    var serverHouse = [[serverFQDN1, "55556", "55555"], [serverFQDN2, "55556", "55555"]];
    var serverAppEngine = [["home-automation-7.appspot.com", "", "80"]];

    var querysHouseUsers = [['/data?type=configuration&data={"label":"userId"}', 30000],
                            ['/data?type=configuration&data={"label":"description"}', 30000],
                            ['/data?type=sensors&data={"label":"net_clients"}', 30000]];
    var querysAppEngineUsers = [['/listUsers/', 30000]];
    var querysHouseSensors = [['/data?type=sensors&data={"label":"1wire"}', 30000]];
    var querysAppEngineSensors = [];

    var querysHouse, querysAppEngine;

    if(role === "users"){
        querysHouse = querysHouseUsers;
        querysAppEngine = querysAppEngineUsers;
    } else if(role === "temperature"){
        querysHouse = querysHouseSensors;
        querysAppEngine = querysAppEngineSensors;
    }

    var q;
    
    for(q in querysHouse){
        this.serverConnections.registerRequest(serverHouse, "GET", querysHouse[q][0], querysHouse[q][1], this.parseIncoming.bind(this));
    }
    for(q in querysAppEngine){
        this.serverConnections.registerRequest(serverAppEngine, "GET", querysAppEngine[q][0], querysAppEngine[q][1], this.parseIncoming.bind(this));
    }
};


function Connections(){
    'use strict';
    this.wsOpen = {};
    this.htmlAttempt = {};
    this.requestQueue = {};
    this.wsTimeout = 200;                // ms
    this.retryConnectionTimeout = 20000; // ms
}

/* Register a query to be sent to server(s) at specified intervals.
 *
 * Args:
 *   serverList: [[server_FQDN, WebSoccket_port, HTTP_port], [server_FQDN_2, WebSoccket_port_2, HTTP_port_2], [etc]]
 *   method:     GET/POST/etc
 *   path:       Data to be sent. Sent in Path for HTTP-GET. Sent as payload for WS-GET.
 *   timeBetweenRequests: Number of ms to wait before doing this again. */
Connections.prototype.registerRequest = function(serverList, method, path, timeBetweenRequests, callback){
    'use strict';
    console.log("Connections.registerRequest");

    if(path in this.requestQueue){
        clearTimeout(this.requestQueue.path[2]);
    }
    var timer = window.setInterval(function(){this.doRequest(serverList, method, path, callback);}.bind(this), timeBetweenRequests);
    this.requestQueue[path] = [serverList, timeBetweenRequests, timer];

    // As well as queueing it up for later, also do it now.
    this.doRequest(serverList, method, path, callback);
};

Connections.prototype.doRequest = function(serverList, method, path, callback){
    'use strict';
    //console.log("Connections.doRequest(" + serverList + ", " + path + ")");

    if("stopDataSwitch" in controlSettings && controlSettings.stopDataSwitch === 1){
        // Don't try to connect.
        return;
    }

    var retrySoon = 0;
    var ws_sucess = 0;

    var server, address, wsPort, httpPort, url;

    // Check if there are any open WebSockets already.
    for(server in serverList){
        address = serverList[server][0];
        wsPort = serverList[server][1];
        httpPort = serverList[server][2];

        if("stopWsSwitch" in controlSettings && controlSettings.stopWsSwitch === 1){
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
        // No open WebSockets to target path so try opening, then try HTTP.
        for(server in serverList){
            address = serverList[server][0];
            wsPort = serverList[server][1];
            httpPort = serverList[server][2];

            if("stopWsSwitch" in controlSettings && controlSettings.stopWsSwitch === 1){
                // Deliberately cause WS to fail for debugging.
                wsPort = String(parseInt(wsPort) +1);
            }

            // try to open a WebSocket.
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
                    // Must have timed out while connecting. Treat as failure.
                    console.log("*** FAIL ***", Date.now() - this.wsOpen[url][1], this.wsTimeout);
                } else if((!(url in this.wsOpen)) || this.wsOpen[url][0].websocket === null || 
                            (this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.CLOSED &&
                            Date.now() - this.wsOpen[url][1] > this.retryConnectionTimeout)){
                    // Haven't tried this connection before or it's been so long it's worth trying again.
                    console.log("Opening WS to " + url);
                    var websocket = new WS(url, callback);
                    this.wsOpen[url] = [websocket, Date.now()];

                    retrySoon = 1;
                    break;
                }
            }

            // Try to use HTTP.
            if(httpPort){
                var httpRequest;

                url = address + ":" + httpPort + path;
                //console.log("Try HTTP.");
                if(!(url in this.htmlAttempt)){
                    httpRequest = new HTTP(callback);
                    httpRequest.initialise(url);
                    this.htmlAttempt[url] = [httpRequest, Date.now()];
                } else {
                    httpRequest = this.htmlAttempt[url][0];
                    if(!httpRequest.busy && (httpRequest.xmlHttp.status === 200 || Date.now() - this.htmlAttempt[url][1] > this.retryConnectionTimeout)){
                        // Busy flag not set and last try was sucessfull (or was long enough ago to try again).
                        httpRequest.initialise(url);
                        this.htmlAttempt[url][1] = Date.now();
                        //console.log("* ", url, path);
                    } else {
                        // Too busy to do http request just now or it's too soon since this target failed.
                        //console.log("- ", url, path);
                    }
                }
            }
        }
    }
    if(retrySoon == 1){
        // Come back soon to see if we ahve managed to connect.
        window.setTimeout(function(){this.doRequest(serverList, method, path);}.bind(this), this.wsTimeout / 10);
    }
};


function WS(url, callback){
    'use strict';
    this.websocket = null;
    this.url = url;
    this.callback = callback;
    this.path = "/get";

    this.initialise();

    this.wsTearDownAfter = 60000;        // ms
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
    this.setTimeout();
};

WS.prototype.onClose = function(evt){
    'use strict';
    console.log("WS.onClose", evt);
};

WS.prototype.onMessage = function(evt){
    'use strict';
    console.log("WS.onMessage", evt.data.length);
    this.callback(evt.data);
    //console.log("WS.onMessage", evt.data);
    this.setTimeout();
};

WS.prototype.onError = function(evt){
    'use strict';
    console.log("WS.onError", evt.data);

};

/* If WebSocket is idle for a long time (ie, has not triggered the onMessage() event,
 * we might as well close it. */
WS.prototype.setTimeout = function(){
    if(typeof this.timeoutTimer !== "undefined"){
        clearTimeout(this.timeoutTimer);
    }
    this.timeoutTimer = window.setTimeout(function(){this.websocket.close();}.bind(this), this.wsTearDownAfter);
};



function HTTP(callback){
    'use strict';
    this.callback = callback;
    this.busy = 0;
    this.error = 0;
}

HTTP.prototype.initialise = function(url){
    'use strict';
    //console.log("HTTP.initialise", this.url);
    this.busy = 1;
    this.xmlHttp = new XMLHttpRequest();
        if ("withCredentials" in this.xmlHttp){
            // Firefox, Chrome, etc.
            this.xmlHttp.open( "GET", "http://" + url, true );
            //console.log('FF, Chrome', 'XDomain');
        } else if (typeof XDomainRequest != "undefined") {
            // IE
            this.xmlHttp = new XDomainRequest();
            this.xmlHttp.open( "GET", "http://" + url);
            //console.log('IE', 'XDomain');
        } else {
            // Otherwise, CORS is not supported by the browser.
            this.xmlHttp = null;
            console.log('Unsuported browser.');
        }
        this.xmlHttp.withCredentials = true;
    try {
        this.xmlHttp.send( null );

        this.xmlHttp.onloadstart = function(evt) { this.onloadstart(evt); }.bind(this);
        this.xmlHttp.onprogress = function(evt) { this.onprogress(evt); }.bind(this);
        this.xmlHttp.onabort = function(evt) { this.onabort(evt); }.bind(this);
        this.xmlHttp.onerror = function(evt) { this.onerror(evt); }.bind(this);
        this.xmlHttp.onload = function(evt) { this.onload(evt); }.bind(this);
        this.xmlHttp.ontimeout = function(evt) { this.ontimeout(evt); }.bind(this);
        this.xmlHttp.onloadend = function(evt) { this.onloadend(evt); }.bind(this);
        this.xmlHttp.onreadystatechange = function(evt) { this.onreadystatechange(evt); }.bind(this);
    }catch(e){
        console.log(e);
    }
};

HTTP.prototype.onloadstart = function(evt){
    'use strict';
    //console.log("onloadstart", evt);
};

HTTP.prototype.onprogress = function(evt){
    'use strict';
    //console.log("onprogress", evt);
};

HTTP.prototype.onabort = function(evt){
    'use strict';
    //console.log("onabort", evt);
    this.error = 1;
};

HTTP.prototype.onerror = function(evt){
    'use strict';
    console.log("onerror", evt);
    this.error = 1;
};

HTTP.prototype.onload = function(evt){
    'use strict';
    //console.log("onload", evt);
};

HTTP.prototype.ontimeout = function(evt){
    'use strict';
    //console.log("ontimeout", evt);
};

HTTP.prototype.onloadend = function(evt){
    'use strict';
    //console.log("onloadend", evt);
    //console.log(this.xmlHttp);
    //console.log(evt.type);
    if(!this.error){
        console.log("HTTP.onloadend", this.xmlHttp.responseText.length);
        this.callback(this.xmlHttp.responseText);
    }
    this.busy = 0;
    this.error = 0;
};

HTTP.prototype.onreadystatechange = function(evt){
    'use strict';
    //console.log("onreadystatechange", evt);
};


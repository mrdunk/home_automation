/* global AuthKey */
/* global serverFQDN1 */
/* global serverFQDN2 */
/* global appEngineFQDN */
/* global controlSettings */
/* exported GetAuthKey */

// TypeDefs:
var ConnectionsToSend, ConnectionsToPoll, WS, HTTP;


/* Get the auth key.
 * No point using the regular framework to get this key because nothing else will work without it.
 * We do a blocking wget for the key. */
function GetAuthKey(){
    'use strict';
    
    // See if key has been sent as POST.
    if(location.hash.indexOf('key=') === 1){
        console.log(location.hash.substr(5), 'Auth');
        return location.hash.substr(5);
    }

    // Otherwise, get key from server.
    var returnedData;
    var url = '/authKey/';
    var request = new XMLHttpRequest();

    request.onreadystatechange = function() { //Call a function when the state changes.
        console.log(request.readyState, request.status);
        if(request.readyState === 4 && request.status === 200) {
            returnedData = request.responseText;
            returnedData = JSON.parse(returnedData);
            console.log(returnedData.key);
        }
    };

    var async = false;
    var method = 'GET';
    request.open(method, url, async);

    // Nasty way round the fact that AppEngine server will cause re-direct if user not logged in.
    try{
        request.send(null);
    }catch(err){
        console.log(err);
        returnedData = {loginStatus: false,
                url: '/logIn/'};
    }

    if(returnedData.loginStatus === true){
        console.log(returnedData.key, 'Auth');
        return returnedData.key;
    }

    window.location = returnedData.url;
}


function DataStore(){
    'use strict';
    this.serverConnectionsToPoll = new ConnectionsToPoll();
    this.serverConnectionsToSend = new ConnectionsToSend();
    this.allDataContainer = {};
    this.userDataContainer = {};
    this.callbackFunctions = [];
    this.additionalCallback = [];

    this.setupConnections("users");
    this.setupConnections("temperature");
    this.setupConnections("send");

    // Perform a lookup after 3 seconds (to allow everything to catch up).
    window.setTimeout(function(){this.serverConnectionsToPoll.doRequestsNow();}.bind(this), 3000);
}

DataStore.prototype.parseIncoming = function(incomingData, code){
    'use strict';
    //console.log("DataStore.parseIncoming", incomingData, code);
    if(code !== undefined && code !== 200){
        console.log("DataStore.parseIncoming ", incomingData, code);
        return;
    }

    var newObj = [];
    try{
        newObj = JSON.parse(incomingData);
        //console.log(newObj);
    } catch(e) {
        console.log(e);
        console.log(incomingData);
        return;
    }

    var i, j, key, label, val;

    if("ListUsers" in newObj){
        // Unwrap AppEngine format a little bit.
        // TODO ratify the 2 formats.
        newObj = newObj.ListUsers;

        // Empty this.userDataContainer so we can re-build from scratch.
        this.userDataContainer = {};
    }
    for(i in newObj){
        if(newObj[i] === 'invalid user'){
            console.log('Not logged in with registered Google account.');
            // TODO redirect to login page?
        //} else if(typeof newObj[i] === 'string') {
        } else if("data" in newObj[i] && "key" in newObj[i].data && "val" in newObj[i].data){
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

            // Populate the userDataContainer DB with all available data.
            this.userDataContainer[newObj[i].id] = {};
            if(newObj[i].image !== undefined){
                this.userDataContainer[newObj[i].id].image = newObj[i].image.url;
            }
            this.userDataContainer[newObj[i].id].displayName = newObj[i].displayName;
            if(this.userDataContainer[newObj[i].id].home === undefined){
                this.userDataContainer[newObj[i].id].home = false;
            }

            // Loop through network devices and cross reference about associated users.
            for(j in this.allDataContainer){
                if('userId' in this.allDataContainer[j] && this.allDataContainer[j].userId[0] === newObj[i].id){
                    // Save to the regular DB.
                    this.allDataContainer[j].image = [newObj[i].image, Date.now()];
                    this.allDataContainer[j].displayName = [newObj[i].displayName, Date.now()];

                    // Also populate the userDataContainer DB with all available data.
                    if(!("description" in this.allDataContainer[j])){
                        this.allDataContainer[j].description = ["",0];
                    }
                    if(!("net_clients" in this.allDataContainer[j])){
                        this.allDataContainer[j].net_clients = ["",0];
                    }
                    if(!("description" in this.userDataContainer[newObj[i].id])){
                        this.userDataContainer[newObj[i].id].description = [this.allDataContainer[j].description[0]];
                    } else if(this.userDataContainer[newObj[i].id].description.indexOf(this.allDataContainer[j].description[0]) < 0){
                        this.userDataContainer[newObj[i].id].description.push(this.allDataContainer[j].description[0]);
                    }
                    if(!("macAddr" in this.userDataContainer[newObj[i].id])){
                        this.userDataContainer[newObj[i].id].macAddr = [j];
                        this.userDataContainer[newObj[i].id].net_clients = [this.allDataContainer[j].net_clients[0]];
                        if(this.allDataContainer[j].net_clients[0] !== ""){
                            this.userDataContainer[newObj[i].id].home = true;
                        }
                    } else if(this.userDataContainer[newObj[i].id].macAddr.indexOf(j) < 0){
                        this.userDataContainer[newObj[i].id].macAddr.push(j);
                        this.userDataContainer[newObj[i].id].net_clients.push(this.allDataContainer[j].net_clients[0]);
                        if(this.allDataContainer[j].net_clients[0] !== ""){
                            this.userDataContainer[newObj[i].id].home = true;
                        }
                    }
                } else if('userId' in this.allDataContainer[j] && this.allDataContainer[j].userId[0] ===""){
                    this.allDataContainer[j].image = [[], Date.now()];
                    this.allDataContainer[j].displayName = ["", Date.now()];
                }
            }
        }
    }
    
    console.log(this.allDataContainer);
    console.log(this.userDataContainer);

    this.doCallbacks();

    // We can also specify aditional callbacks to perform when we have explicetly requested data
    // (rather than receiving it as a scheduled event).
    var callback;
    while((callback = this.additionalCallback.shift())){    // Double perenthesis subdue JSLint assignment warning.
        //console.log(incomingData, code);
        callback();
    }
};

/* Perform any callback fuctions that have been registered. */
DataStore.prototype.doCallbacks = function(){
    'use strict';
    // Make sure we don't update things more often than reqired.
    // Limit to a 50Hz cycle.
    if(!this.queueUpdate){                
        this.queueUpdate = true;
        window.setTimeout(function(){
                for(var callback in this.callbackFunctions){
                    this.callbackFunctions[callback]();
                }
                this.queueUpdate = false;}.bind(this), 20);
    } else {
        console.log(".");
    }
};

/* Register callback functions to perform when data changes. */
DataStore.prototype.registerCallbacks = function(callbacks){
    'use strict';
    if(callbacks){
        this.callbackFunctions = callbacks;
    } else {
        this.callbackFunctions = [];
    }
    this.doCallbacks();
};

DataStore.prototype.addCallback = function(callback){
    'use strict';
    this.callbackFunctions.push(callback);
    this.doCallbacks();
};


DataStore.prototype.setupConnections = function(role){
    'use strict';
    // [serverFQDN, webSocket_port, http_port]
    this.serverHouse = [[serverFQDN1, "55556", "55555"], [serverFQDN2, "55556", "55555"]];
    this.serverAppEngine = [[appEngineFQDN, "", "80"]];

    this.querysHouseUsers = [['/data?type=configuration&data={"label":"userId"}', 30000],
                             ['/data?type=configuration&data={"label":"description"}', 30000],
                             ['/data?type=sensors&data={"label":"net_clients"}&age=300', 30000],
                             ['/data?type=userInput', 30000],
                             ['/data?type=output', 30000]];

    this.querysAppEngineUsers = [['/listUsers/?', 30000]];
    this.querysHouseSensors = [['/data?type=sensors&data={"label":"1wire"}', 30000]];
    this.querysAppEngineSensors = [];

    var querysHouse, querysAppEngine;

    if(role === "users"){
        querysHouse = this.querysHouseUsers;
        querysAppEngine = this.querysAppEngineUsers;
    } else if(role === "temperature"){
        querysHouse = this.querysHouseSensors;
        querysAppEngine = this.querysAppEngineSensors;
    }

    var q;
    
    for(q in querysHouse){
        this.serverConnectionsToPoll.registerRequest(this.serverHouse, "GET", querysHouse[q][0], querysHouse[q][1], this.parseIncoming.bind(this));
    }
    for(q in querysAppEngine){
        this.serverConnectionsToPoll.registerRequest(this.serverAppEngine, "GET", querysAppEngine[q][0], querysAppEngine[q][1], this.parseIncoming.bind(this));
    }

    if(role === "send"){
        this.serverConnectionsToSend.registerRequest(role, this.serverHouse, "POST");
    }
};

/* Args:
 *  destination: "house" or "appengine".
 *  path: Path and arguments of URL.
 *  callback: Function to call when complete.
 */
DataStore.prototype.sendQueryNow = function(destination, path, callback){
    'use strict';
    console.log("DataStore.sendQueryNow");
    this.additionalCallback.push(callback);
    if(destination === "house"){
        this.serverConnectionsToPoll.doRequest(this.serverHouse, "GET", path, callback);
    } else if(destination === "appengine"){
        this.serverConnectionsToPoll.doRequest(this.serverAppEngine, "GET", path, callback);
    }
};

function ConnectionsToSend(){
    'use strict';
    this.htmlTargets = {};
    this.htmlAttempt = {};
    this.sendTimeout = 500;  // ms.
}

ConnectionsToSend.prototype.registerRequest = function(key, serverList, method){
    'use strict';
    console.log("ConnectionsToSend.registerRequest");

    this.htmlTargets[key] = [[serverList, 0], method];
};

ConnectionsToSend.prototype.send = function(key, sendData, callback, retries){
    'use strict';
    console.log("ConnectionsToSend.send", key, sendData);

    if(retries !== undefined && retries !== 0){
        // call this function again later unless callbackWrapper() is called.
        retries -= 1;
        this.retry = setTimeout(function(){this.send(key, sendData, callback, retries
                                                    );}.bind(this), this.sendTimeout);
    }

    var callbackWrapper = function(data, code){
        console.log('callbackWrapper(' + data + ', ' + code + ')', retries);
        if(this.retry !== undefined){
            // No need to retry this function if callback was sucessfully reached.
            clearTimeout(this.retry);
        }
        if(code === 200){
            callback(data);
        }
    }.bind(this);

    if(this.htmlTargets[key] === undefined){
        console.log("\"" + key + "\" was not a registered target.");
        return;
    }

    //var serverMethod = this.htmlTargets[key][1];
    var serverIndex = this.htmlTargets[key][0][1];
    var serverList = this.htmlTargets[key][0][0][serverIndex];

    var url = serverList[0] + ":" + serverList[2] + "/clientput?key=" + AuthKey;
    //console.log(serverIndex, url, sendData);
    var httpRequest;

    if(!(url in this.htmlAttempt)){
        console.log("new HTTP()");
        httpRequest = new HTTP(callbackWrapper, url, "POST");
        httpRequest.initialise(sendData);
        this.htmlAttempt[url] = [httpRequest, Date.now()];
    } else {
        httpRequest = this.htmlAttempt[url][0];
        if(httpRequest.xmlHttp.status === undefined || httpRequest.xmlHttp.status === 0){
            // This request failed last time so set pointer to other targets in the list and retry.
            console.log("retrying... ", serverIndex);
            delete this.htmlAttempt[url];
            serverIndex += 1;
            if(serverIndex >= this.htmlTargets[key][0][0].length){
                serverIndex = 0;
            }
            this.htmlTargets[key][0][1] = serverIndex;
            this.send(key, sendData, callback, retries);
            return;
        }
        if(!httpRequest.busy && (httpRequest.xmlHttp.status > 0 || 
                    Date.now() - this.htmlAttempt[url][1] > this.retryConnectionTimeout)){
            // Busy flag not set and last try got through to server
            // (or was long enough ago to try again).
            httpRequest.initialise(sendData);
            this.htmlAttempt[url][1] = Date.now();
            //console.log("* ", url, path);
        }
    }
};


function ConnectionsToPoll(){
    'use strict';
    this.wsOpen = {};
    this.htmlAttempt = {};
    this.requestQueue = {};
    this.wsTimeout = 500;                // ms
    this.retryConnectionTimeout = 20000; // ms
}

/* Register a query to be sent to server(s) at specified intervals.
 *
 * Args:
 *   serverList: [[server_FQDN, WebSoccket_port, HTTP_port],
 *                [server_FQDN_2, WebSoccket_port_2, HTTP_port_2], [etc]]
 *   method:     GET/POST/etc
 *   path:       Data to be sent. Sent in Path for HTTP-GET. Sent as payload for WS-GET.
 *   timeBetweenRequests: Number of ms to wait before doing this again. */
ConnectionsToPoll.prototype.registerRequest = function(serverList, method, path, timeBetweenRequests, callback){
    'use strict';
    if(path in this.requestQueue){
        //clearTimeout(this.requestQueue.path[2]);
        // Already registered.
        return;
    }
    console.log("ConnectionsToPoll.registerRequest", path);
    var timer = window.setInterval(function(){this.doRequest(serverList, method, path, callback
                                                            );}.bind(this), timeBetweenRequests);
    this.requestQueue[path] = [serverList, timeBetweenRequests, timer, callback];

    // As well as queueing it up for later, also do it now.
    this.doRequest(serverList, method, path, callback);
};

/* Do all requests now rather than wait for the scheduled event. */
ConnectionsToPoll.prototype.doRequestsNow = function(){
    'use strict';
    for(var path in this.requestQueue){
        this.doRequest(this.requestQueue[path][0], 'get', path, this.requestQueue[path][3]);
    }
};

ConnectionsToPoll.prototype.doRequest = function(serverList, method, path, callback){
    'use strict';
    //console.log("ConnectionsToPoll.doRequest(" + serverList + ", " + path + ")");

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

        if(wsPort && "stopWsSwitch" in controlSettings && controlSettings.stopWsSwitch === 1){
            // Deliberately cause WS to fail for debugging.
            wsPort = String(parseInt(wsPort) +10);
        }

        if(wsPort){
            url = address + ":" + wsPort;
            if(url in this.wsOpen && this.wsOpen[url][0].websocket !== null &&
                    this.wsOpen[url][0].websocket.readyState === this.wsOpen[url][0].websocket.OPEN){
                var openFor = Date.now() - this.wsOpen[url][1];
                console.log("WS already open to " + url + " for " + openFor + " ms.");
                ws_sucess = url;

                // Send the request.
                this.wsOpen[url][0].websocket.send(path + "&key=" +  AuthKey);
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

            if(wsPort && "stopWsSwitch" in controlSettings && controlSettings.stopWsSwitch === 1){
                // Deliberately cause WS to fail for debugging.
                wsPort = String(parseInt(wsPort) +10);
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
                    console.log("*** FAIL ***", url, Date.now() - this.wsOpen[url][1], this.wsTimeout);
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

                url = address + ":" + httpPort + path + "&key=" + AuthKey;
                //console.log("Try HTTP.");
                if(!(url in this.htmlAttempt)){
                    httpRequest = new HTTP(callback, url, "GET");
                    httpRequest.initialise(null);
                    this.htmlAttempt[url] = [httpRequest, Date.now()];
                } else {
                    httpRequest = this.htmlAttempt[url][0];
                    if(!httpRequest.busy && ([200, 403].indexOf(httpRequest.xmlHttp.status) >= 0 || Date.now() - this.htmlAttempt[url][1] > this.retryConnectionTimeout)){
                        // Busy flag not set and last try was sucessfull (or was long enough ago to try again).
                        httpRequest.initialise(null);
                        this.htmlAttempt[url][1] = Date.now();
                        //console.log("* ", url, path);
                    //} else {
                        // Too busy to do http request just now or it's too soon since this target failed.
                        //console.log("- ", url, path);
                    }
                }
            }
        }
    }
    if(retrySoon === 1){
        // Come back soon to see if we have managed to connect.
        window.setTimeout(function(){this.doRequest(serverList, method, path, callback);}.bind(this), this.wsTimeout / 10);
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
    //console.log("WS.onOpen", evt);
    this.setTimeout();
};

WS.prototype.onClose = function(evt){
    'use strict';
    //console.log("WS.onClose", evt);
};

WS.prototype.onMessage = function(evt){
    'use strict';
    //console.log("WS.onMessage", evt.data.length, this.callback);
    //console.log("WS.onMessage", evt.data);
    this.callback(evt.data);
    this.setTimeout();
};

WS.prototype.onError = function(evt){
    'use strict';
    console.log("WS.onError", evt.data);
};

/* If WebSocket is idle for a long time (ie, has not triggered the onMessage() event,
 * we might as well close it. */
WS.prototype.setTimeout = function(){
    'use strict';
    if(typeof this.timeoutTimer !== "undefined"){
        clearTimeout(this.timeoutTimer);
    }
    this.timeoutTimer = window.setTimeout(function(){this.websocket.close();}.bind(this), this.wsTearDownAfter);
};



function HTTP(callback, url, method){
    'use strict';
    this.callback = callback;
    this.url = url;
    this.method = method;
    this.busy = 0;
    this.error = 0;
}

HTTP.prototype.initialise = function(sendData){
    'use strict';
    //console.log("HTTP.initialise", this.url);
    this.busy = 1;
    this.xmlHttp = new XMLHttpRequest();

    if("withCredentials" in this.xmlHttp){
        // Firefox, Chrome, etc.
        this.xmlHttp.open(this.method, "http://" + this.url, true );
        //console.log('FF, Chrome', 'XDomain');
    /* jshint wsh: true */
    } else if (typeof XDomainRequest !== "undefined") {
        // IE
        this.xmlHttp = new XDomainRequest();
        this.xmlHttp.open(this.method, "http://" + this.url);
        //console.log('IE', 'XDomain');
    } else {
        // Otherwise, CORS is not supported by the browser.
        this.xmlHttp = null;
        console.log('Unsuported browser.');
    }
    this.xmlHttp.withCredentials = true;

    try {
        if(this.method.toUpperCase() === "POST"){
            this.xmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            //this.xmlHttp.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
        }
        this.xmlHttp.onloadstart = function(evt) { this.onloadstart(evt); }.bind(this);
        this.xmlHttp.onprogress = function(evt) { this.onprogress(evt); }.bind(this);
        this.xmlHttp.onabort = function(evt) { this.onabort(evt); }.bind(this);
        this.xmlHttp.onerror = function(evt) { this.onerror(evt); }.bind(this);
        this.xmlHttp.onload = function(evt) { this.onload(evt); }.bind(this);
        this.xmlHttp.ontimeout = function(evt) { this.ontimeout(evt); }.bind(this);
        this.xmlHttp.onloadend = function(evt) { this.onloadend(evt); }.bind(this);
        this.xmlHttp.onreadystatechange = function(evt) { this.onreadystatechange(evt); }.bind(this);

        this.xmlHttp.send(sendData);
    } catch(e){
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
    console.log("onabort", evt);
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
    //console.log("onloadend", evt, this.xmlHttp.status);
    //console.log(this.xmlHttp);
    //console.log(evt.type);
    if(!this.error && [200, 403].indexOf(this.xmlHttp.status) >= 0){
        //console.log("HTTP.onloadend", this.xmlHttp.status, this.xmlHttp.statusText);//.length);
        if(this.callback !== undefined){
            this.callback(this.xmlHttp.responseText, this.xmlHttp.status);
        }
    }
    this.busy = 0;
    this.error = 0;
};

HTTP.prototype.onreadystatechange = function(evt){
    'use strict';
    //console.log("onreadystatechange", evt);
};


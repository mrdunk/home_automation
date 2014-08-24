function Connection(tryWebSocket){
    this.tryWebSocket = tryWebSocket;   // Try to use Websockets if browser supports them.
    this.sockets = {};                  // Container for currently usable websockets.
    this.repeatTimers = {};             // Dictionary of connections that will re-try at some point in the future.
    this.successCounter = 5;            // Counter tracking successfull connections vs failed.
    this.connectionsInProgres = {};        // A dict of flags for monitoring whether connection has completed successfully or not.
}

/* Only used for WebSockets.
 * Try to re-use an existing Websocket or create new one.
 * Args:
 *   urlDomain: The Domain of the websocket address we are looking for.
 *   urlQueryList: List of paths we will send to the WebSocket. */
Connection.prototype.getSocket = function(uid, urlDomain, urlQueryList){
    'use strict';
    //console.log('Connection.getSocket');
    if ((typeof this.sockets[urlDomain] === 'undefined') || (this.sockets[urlDomain].readyState !== 1)){
        console.log('  new');

        // We take the fact there is not an existing valid socket in the buffer to mean that tha last one failed in some way.
        this.getDataFail(uid);

        // Make and store new socket.
        this.sockets[urlDomain] = new WebSocket('ws://' + urlDomain, authKey);
    } else {
        // The send() will be done by socket.onopen for new webSockets, but since this one is already open, do it now.
        this.send(this.sockets[urlDomain], urlQueryList);
    }

    this.sockets[urlDomain].replyCount = 0;
    return this.sockets[urlDomain];
};

/* Perform a send() on the WebSocket object.
 *  Args:
 *      socket: The WebSocket object.
 *      urlQueryList: List of paths we will send to the WebSocket. */
Connection.prototype.send = function(socket, urlQueryList){
        'use strict';
        for (var item in urlQueryList){
                socket.send(JSON.stringify(urlQueryList[item]));
        }
};

Connection.prototype.clearRepeatTimers = function (clearUid){
    if(typeof clearUid === 'undefined'){
        // Since none was specified, clear all timers.
        for(var uid in this.repeatTimers){
            clearTimeout(this.repeatTimers[uid]);
            delete this.repeatTimers[uid];
        }
    } else {
        // Only clear the specified timer.
        clearTimeout(this.repeatTimers[clearUid]);
        delete this.repeatTimers[clearUid];
    }
    log(Object.keys(this.repeatTimers).length, 'Conections');
};

Connection.prototype.swapServer = function(url){
    if((url.host !== serverFQDN) && ((url.host === serverFQDN1) || (url.host === serverFQDN2))){
        // host has changed.
        
        // Remove old one from cache.
        console.log(this.sockets);
        var urlDomain = url.host + ':' + url.port + url.path;
        delete this.sockets[urlDomain];

        // and re-map query to new one.
        if(url.host === serverFQDN1){
            url.host = serverFQDN2;
            url.port = serverCubeMetricPort2;
        } else {
            url.host = serverFQDN1;
            url.port = serverCubeMetricPort1;
        }
    }
};

/* Call when Connection.getData() suceeds. */
Connection.prototype.getDataSuccess = function (uid, useCallback){
    'use strict';
    // Clear flag signifying this connection has finished.
    this.connectionsInProgres[uid] = false;

    if(this.successCounter < 10){
        this.successCounter += 1;
        log(this.successCounter, 'Connection success');
        useCallback(true);
    }
};

/* Call when Connection.getData() fails. */
Connection.prototype.getDataFail = function (uid){
        'use strict';
        // Clear flag signifying this connection has finished.
        this.connectionsInProgres[uid] = false;

        if(this.successCounter > 0){
            this.successCounter -= 1;
            log(this.successCounter, 'Connection success');
        }
};

Connection.prototype.getData = function (uid, urlWs, urlWget, urlQueryList, retryIn, parseCallback, useCallback) {
    'use strict';
    if(this.connectionsInProgres[uid] === 'undefined'){
        // first time running this connection uid.
        this.connectionsInProgres[uid] = false;
    }

    if(this.connectionsInProgres[uid] === true){
        // This connection has not finished and cleared flag. Timeout condition.
        this.getDataFail(uid);
    }
    this.connectionsInProgres[uid] = true;


    // See if there is a timer for this event already and clear it if there is.
    if(typeof this.repeatTimers[uid] !== 'undefined'){
        clearTimeout(this.repeatTimers[uid]);
    }
    // Set a new timer if appropriate.
    if(retryIn > 0){
        this.repeatTimers[uid] = setTimeout(function(){this.getData(uid, urlWs, urlWget, urlQueryList, retryIn, parseCallback, useCallback);}.bind(this), retryIn);
    }
    log(Object.keys(this.repeatTimers).length, 'Conections');

    // Now send the request for the data.
    if (this.tryWebSocket && (urlWs !== false) && ('WebSocket' in window)){
        this.getDataWs(uid, urlWs, urlQueryList, parseCallback, useCallback);
    } else{
        this.getDataWget(uid, urlWget, urlQueryList, parseCallback, useCallback);
    }

    // If we haven't sucessfully received data for a while...
    if(this.successCounter === 0){
        // switch off dial.
        useCallback(false);

        // Abuse this counter so we don't swap hosts every failure.
        this.successCounter = 5;

        // Change which server we use.
        if(serverFQDN === serverFQDN1){
            serverFQDN = serverFQDN2;
            serverCubeMetricPort = serverCubeMetricPort2;
            serverCubeCollectorPort = serverCubeCollectorPort2;
        } else {
            serverFQDN = serverFQDN1;
            serverCubeMetricPort = serverCubeMetricPort1;
            serverCubeCollectorPort = serverCubeCollectorPort1;
        }
        log(serverFQDN, 'serverFQDN');
    }

    if(typeof this.repeatTimers[uid] !== 'undefined'){
        return this.repeatTimers[uid];
    }
};

Connection.prototype.getDataWs = function (uid, urlWs, urlQueryList, parseCallback, useCallback) {
    'use strict';
    log(Object.keys(this.sockets).length, 'WebSockets');

    this.swapServer(urlWs);

    var retVals = {};
    var urlDomainWs = urlWs.host + ':' + urlWs.port + urlWs.path;
    var socket = this.getSocket(uid, urlDomainWs, urlQueryList);
    var receivedData = 0;
    console.log(urlDomainWs);

    socket.onopen = function() {
        this.send(socket, urlQueryList);
    }.bind(this);

    socket.onmessage = function(message) {
        if(parseCallback('ws', message.data, retVals) !== null){
            // data still arriving and populating retVals.
            receivedData += 1;
        } else {
            // Empty message signifies end of reply.
            socket.replyCount += 1;
            if (socket.replyCount === urlQueryList.length){
                // All expected replies have been recieved.
                if (typeof useCallback !== 'undefined' && receivedData > 0){
                    useCallback(retVals);
                    this.getDataSuccess(uid, useCallback);
                }
            }
        }
    }.bind(this);

    socket.onerror = function(error){
        console.log('ws-error:', error);

        // Remove this websocket from the list.
        if (typeof this.sockets !== 'undefined'){
            delete this.sockets[urlDomainWs];
        }

        // We still want to do the callback so depandents know that no data is being received.
        if (typeof useCallback !== 'undefined'){
            useCallback({});
        }
    }.bind(this);

    return retVals;
};


Connection.prototype.getDataWget = function (uid, urlWget, urlQueryList, parseCallback, useCallback) {
    'use strict';
    log('false', 'WebSockets');
    var retVals = {};

    this.swapServer(urlWget);

    var urlDomainWget = urlWget.host + ':' + urlWget.port + urlWget.path;

    var firstError;
    firstError = true;
    var httpRequest = function(url){
        var request = new XMLHttpRequest();
        request.onreadystatechange = function() {   //Call a function when the state changes.
            if(request.readyState === 4 && request.status === 200) {

                var returnedData = request.responseText;

                parseCallback('wget', returnedData, retVals);
            } else if(request.readyState === 4) {
                // error
                // We rely on the connectionTimeout to call error handling code.
            }
            // either data has arrived or there was a problem so execute callback function.
            if (typeof useCallback !== 'undefined' && request.readyState === 4){
                useCallback(retVals);
                this.getDataSuccess(uid, useCallback);
            }
        }.bind(this);
        var async = true;
        var method = 'GET';
        if ("withCredentials" in request){
            // Firefox, Chrome, etc.
            request.open(method, url, async);
            log('FF, Chrome', 'XDomain');
        } else if (typeof XDomainRequest != "undefined") {
            // IE
            request = new XDomainRequest();
            request.open(method, url);
            log('IE', 'XDomain');
        } else {
            // Otherwise, CORS is not supported by the browser.
            request = null;
            console.log('Unsuported browser.');
            log('unsuported', 'XDomain');
        }
        request.withCredentials = true;

        // We piggyback our authentication key on the Content-Type as Chrome does not allow us to modify any other headers.
        request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8,X-Key=' + authKey);
        request.send(null);
    }.bind(this);

    var urlBase = 'http://' + urlDomainWget + '?';
    for (var item in urlQueryList){
        var url = urlBase;
        for (var key in urlQueryList[item]){
            url += key + '=' + urlQueryList[item][key] + '&';
        }
        httpRequest(url);
    }
    return retVals;
};

Connection.prototype.sendData = function (uid, urlWs, urlWget, dataList){
    'use strict';
    if (this.tryWebSocket && (urlWs !== false) && ('WebSocket' in window)){
        this.sendDataWs(uid, urlWs, dataList);
    } else{
        this.sendDataWget(uid, urlWget, dataList);
    }
};

Connection.prototype.sendDataWs = function (uid, urlWs, dataList){
    'use strict';
    var urlDomainWs = urlWs.host + ':' + urlWs.port + urlWs.path;
    var socket = this.getSocket(uid, urlDomainWs, dataList);
    console.log(urlDomainWs, dataList);

    socket.onopen = function() {
        this.send(socket, dataList);
    }.bind(this);
    socket.onerror = function(error) {
        console.log("error", error);
    };
    socket.onmessage = function(message) {
        console.log('message', message);
    };

};

Connection.prototype.sendDataWget = function (uid, urlWget, dataList){
    'use strict';
    // TODO implement retries on failure.

    var urlDomainWs = 'http://' + urlWget.host + ':' + urlWget.port + urlWget.path;

    console.log(urlDomainWs);

    var request = new XMLHttpRequest();
    request.onreadystatechange = function() { //Call a function when the state changes.
        if(request.readyState === 4 && request.status === 200) {
            console.log(request.responseText);
        } else if(request.readyState === 4) {
            // Since request.status !=== 200,
            // this is an error.
            // Rather than handling the error here it is simpler to have a single failure timer that gets canceled on successa (Still TODO.).
        }
    };
    var async = true;
    var method = 'POST';

    if ("withCredentials" in request){
        // Firefox, Chrome, etc.
        request.open(method, urlDomainWs, async);
        log('FF, Chrome', 'XDomain');
    } else if (typeof XDomainRequest != "undefined") {
        // IE
        request = new XDomainRequest();
        request.open(method, urlDomainWs);
        log('IE', 'XDomain');
    } else {
        // Otherwise, CORS is not supported by the browser.
        request = null;
        console.log('Unsuported browser.');
        log('unsuported', 'XDomain');
    }
    request.withCredentials = true;

    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded,X-Key=' + authKey);
    request.send(JSON.stringify(dataList));
};

var parseDataCube = function(type, data, retVals){
        data = JSON.parse(data);
        if(data === null){
                return null;
        }

        var label, key, val;

        if(type === 'wget'){
                for (var dataKey in data){
                        var item = data[dataKey];
                        label = item.data.label;
                        key = item.data.key;
                        val = item.data.val;
                        if(typeof label === 'undefined'){
                                // Data is a list of (key,val).
                                if(!(key in retVals)){
                                        retVals[key] = [];
                                }
                                retVals[key].push(val);
                        } else {
                                // Data contains list of (label, key, val).
                                if(!(label in retVals)){
                                        retVals[label] = [];
                                }
                                if(!(key in retVals[label])){
                                        retVals[label][key] = [];
                                }
                                retVals[label][key].push(val);
                        }
                }
                return retVals;
        } else {
                label = data.data.label;
                key = data.data.key;
                val = data.data.val;
                if(typeof label === 'undefined'){
                        // Data is a list of (key,val).
                        if(!(key in retVals)){
                                retVals[key] = [];
                        }
                        retVals[key].push(val);
                } else {
                        // Data contains list of (label, key, val).
                        if(!(label in retVals)){
                                retVals[label] = [];
                        }
                        if(!(key in retVals[label])){
                                retVals[label][key] = [];
                        }
                        retVals[label][key].push(val);
                }
        }
};

var parseDataAppEngine = function(type, data, retVals){
        data = JSON.parse(data);
        if(data === null){
                //console.log('ae: null');
                return null;
        }
        //console.log('ae:', data);
        if('ListUsers' in data){
                if(!('ListUsers' in retVals)){
                        retVals.users = {};
                }
                for(var key in data.ListUsers){
                        var user = data.ListUsers[key];
                        retVals.users[data.ListUsers[key].id] = {displayName: data.ListUsers[key].displayName,
                                                                 image: data.ListUsers[key].image.url};
                }
        }
};


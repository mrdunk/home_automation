function Connection(tryWebSocket){
    this.tryWebSocket = tryWebSocket;   // Try to use Websockets if brouser supports them.
    this.sockets = {};                  // Container for currently usable websockets.
    this.repeatTimers = {};             // Dictionary of connections that will re-try at soem point in the future.
}

/* Try to re-use an existing Websocket or create new one.
 * Args:
 *   urlDomain: The Domain of the websocket address we are looking for.
 *   urlQueryList: List of paths we will send to the WebSocket. */
Connection.prototype.getSocket = function(urlDomain, urlQueryList){
    'use strict';
    //console.log('Connection.getSocket');
    if ((typeof this.sockets[urlDomain] === 'undefined') || (this.sockets[urlDomain].readyState !== 1)){
        console.log('  new');
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

Connection.prototype.getData = function (uid, urlDomainWs, urlDomainWget, urlQueryList, retryIn, parseCallback, useCallback) {
    'use strict';

    // We need the timeout to occur before the next itteration of this function, hence the "- (Math.random() * 20)".
    //var connectionTimeout = setTimeout(function(){connectionFail(useCallback);}, timeDataUpdate - (Math.random() * 20) -10);

    // See if there is a timer for this event already and clear it if there is.
    if(typeof this.repeatTimers[uid] !== 'undefined'){
        clearTimeout(this.repeatTimers[uid]);
    }
    // Set a new tiemer if appropriate.
    if(retryIn > 0){
        this.repeatTimers[uid] = setTimeout(function(){this.getData(uid, urlDomainWs, urlDomainWget, urlQueryList, retryIn, parseCallback, useCallback);}.bind(this), retryIn);
    }
    log(Object.keys(this.repeatTimers).length, 'Conections');

    // Now send the request for the data.
    if (this.tryWebSocket && (urlDomainWs !== false) && ('WebSocket' in window)){
        this.getDataWs(urlDomainWs, urlQueryList, parseCallback, useCallback);
    } else{
        this.getDataWget(urlDomainWget, urlQueryList, parseCallback, useCallback);
    }

    if(typeof this.repeatTimers[uid] !== 'undefined'){
        return this.repeatTimers[uid];
    }
};

Connection.prototype.getDataWs = function (urlDomainWs, urlQueryList, parseCallback, useCallback) {
    'use strict';
    log(Object.keys(this.sockets).length, 'WebSockets');

    var retVals = {};
    var socket = this.getSocket(urlDomainWs, urlQueryList);
    var receivedData = 0;

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
                }
            }
        }
    };

    socket.onerror = function(error){
        console.log('ws-error:', error);

        // Remove this websocket from the list.
        if (typeof this.sockets !== 'undefined'){
            delete this.sockets[urlDomainWs];
        }

        // We still want to do the callback so depandants know that no data is being received.
        if (typeof useCallback !== 'undefined'){
            useCallback({});
        }
    };

    return retVals;
};


Connection.prototype.getDataWget = function (urlDomainWget, urlQueryList, parseCallback, useCallback) {
    'use strict';
    log('false', 'WebSockets');
    var retVals = {};

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
                // We rely on the connectionTimeout to call error handling code. TODO
            }
            // either data has arrived or there was a problem so execute callback function.
            if (typeof useCallback !== 'undefined' && request.readyState === 4){
                useCallback(retVals);
            }
        };
        var async = true;
        var method = 'GET';
        if ("withCredentials" in request){
            // Firefox, Chrome, etc.
            request.open(method, url, async);
        } else if (typeof XDomainRequest != "undefined") {
            // IE
            request = new XDomainRequest();
            request.open(method, url);
        } else {
            // Otherwise, CORS is not supported by the browser.
            request = null;
            console.log('Unsuported browser.');
        }
        request.withCredentials = true;


        // We piggyback our authentication key on the Content-Type as Chrome does not allow us to modify any other headers.
        request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8,X-Key=' + authKey);
        request.send(null);
    };

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

// This holds a dict of currently valid webbsocket.
var sockets = {};

/* Try to re-use an already open WebSocket.
 * If that doesn't work, open a new one. 
 * Args:
 *   url: The Url of the websocket we are looking for. */
var getSocket = function(url){
        'use strict';
        //console.log('getSocket', url, query);

        // Try to use existing WebSocket.
        if ((typeof sockets[url] === 'undefined') || (sockets[url].readyState !== 1)){
                sockets[url] = new WebSocket('ws://' + url, authKey);
        } else {
//                getDataSend(sockets[url], query);
            sockets[url].onopen();
        }

        return sockets[url];
};

var getDataSend = function(socket, query){
        'use strict';
        for (var item in query){
                socket.send(JSON.stringify(query[item]));
                //console.log(JSON.stringify(query[item]));
        }
};

var getData = function (urlWs, urlWget, query, parseCallback, useCallback) {
        'use strict';

        var retVals = {};
        var countSocketReplies = 0;

        // We need the timeout to occur before the next itteration of this function, hence the "- (Math.random() * 20)".
        var connectionTimeout = setTimeout(function(){connectionFail(useCallback);}, timeDataUpdate - (Math.random() * 20) -10);


        if (useWebSocket && (urlWs !== false) && ('WebSocket' in window)){
                /* WebSocket is supported.*/
                log(Object.keys(sockets).length, 'WebSockets');

                var socket = getSocket(urlWs);

                socket.onopen = function() {
                        getDataSend(socket, query);
                };
                socket.onmessage = function(message) {
                        if(parseCallback('ws', message.data, retVals) !== null){
                                // data still arriving and populating retVals.
                        } else {
                                // Empty message signifies end of reply.
                                countSocketReplies += 1;
                                if (countSocketReplies === query.length){
                                        // All expected replies have been recieved.
                                        if (typeof useCallback !== 'undefined'){
                                                //console.log(retVals);
                                                setUpdateTime(useWebSocket);  // Restore normal timeouts incase they were extended due to failed transmissions.
                                                clearTimeout(connectionTimeout);
                                                connectionSucess(useCallback);
                                                useCallback(retVals);
                                        }
                                }
                        }
                };
                socket.onerror = function(error){
                        clearTimeout(connectionTimeout);
                        console.log('ws-error:', error);

                        // Remove this websocket from the list.
                        delete sockets[urlWs];

                        // Since we have canceled the connectionTimeout, we need to try the alternative host manually.
                        connectionFail(useCallback);

                        // We still want to do the callback so depandants know that no data is being received.
                        if (typeof useCallback !== 'undefined'){
                                useCallback({});
                        }
                };
        } else {
                /*WebSockets are not supported. Try a fallback method like long-polling etc*/
                log('un-supported', 'WebSocket');

                var firstError;
                firstError = true;
                var httpRequest = function(url){
                        var request = new XMLHttpRequest();
                        request.onreadystatechange = function() {//Call a function when the state changes.
                                if(request.readyState === 4 && request.status === 200) {
                                        setUpdateTime(useWebSocket);  // Restore normal timeouts incase they were extended due to failed transmissions.
                                        connectionSucess(useCallback);
                                        clearTimeout(connectionTimeout);

                                        var returnedData = request.responseText;

                                        parseCallback('wget', returnedData, retVals);
                                } else if(request.readyState === 4) {
                                        // error
                                        // We rely on the connectionTimeout to call error handling code.
                                }
                                // either data has arrived or there was a problem so execute callback function.
                                if (typeof useCallback !== 'undefined'){
                                        useCallback(retVals);
                                }
                        };
                        var async = true;
                        var method = 'GET';
                        if ("withCredentials" in request){
                                // Firefox, Chrome, etc.
                                request.open(method, url, async);
                        } else if (typeof XDomainRequest != "undefined") {
                                // IE
                                request = new XDomainRequest();
                                request.open(method, url);
                        } else {
                                // Otherwise, CORS is not supported by the browser.
                                request = null;
                                console.log('Unsuported browser.');
                        }
                        request.withCredentials = true;


                        // We piggyback our authentication key on the Content-Type as Chrome does not allow us to modify any other headers.
                        request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8,X-Key=' + authKey);
                        request.send(null);
                };


                var urlBase = 'http://' + urlWget + '?';
                for (var item in query){
                        var url = urlBase;
                        for (var key in query[item]){
                                url += key + '=' + query[item][key] + '&';
                        }
                        httpRequest(url);
                }

        }
        return retVals;
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


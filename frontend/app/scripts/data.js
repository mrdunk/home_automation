function Connection(tryWebSocket){
    'use strict';
    this.tryWebSocket = tryWebSocket;   // Try to use Websockets if browser supports them.
    this.sockets = {};                  // Container for currently usable websockets.
    this.repeatTimers = {};             // Dictionary of connections that will re-try at some point in the future.
    this.successCounter = {};           // Counter tracking successfull connections vs failed using uniqueId as key.
    this.connectionsInProgres = {};     // A dict of flags for monitoring whether connection has completed successfully or not.
}

/* Only used for WebSockets.
 * Try to re-use an existing Websocket or create new one.
 * Args:
 *   urlDomain: The Domain of the websocket address we are looking for.
 *   urlQueryList: List of paths we will send to the WebSocket. */
Connection.prototype.getSocket = function(uniqueId, urlDomain, urlQueryList){
    'use strict';
    //console.log('Connection.getSocket');
    if ((typeof this.sockets[urlDomain] === 'undefined') || (this.sockets[urlDomain].readyState !== 1)){

        // We take the fact there is not an existing valid socket in the buffer to mean that tha last one failed in some way.
        this.getDataFail(uniqueId);

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
        for(var uniqueId in this.repeatTimers){
            clearTimeout(this.repeatTimers[uniqueId]);
            delete this.repeatTimers[uniqueId];
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
Connection.prototype.getDataSuccess = function (uniqueId, useCallback){
    'use strict';
    // Clear flag signifying this connection has finished.
    this.connectionsInProgres[uniqueId] = false;

    if(this.successCounter[uniqueId] < 10){
        this.successCounter[uniqueId] += 1;
        log(this.successCounter, 'Connection success');
        useCallback(true);
    }
};

/* Call when Connection.getData() fails. */
Connection.prototype.getDataFail = function (uniqueId){
        'use strict';
        // Clear flag signifying this connection has finished.
        this.connectionsInProgres[uniqueId] = false;

        if(this.successCounter[uniqueId] > 0){
            this.successCounter[uniqueId] -= 1;
            log(this.successCounter, 'Connection success');
        }
};

/* Args:
 *   uniqueId: A unique identifier string. Must be different for each place in the code thi method is called from.
 *   urlWs: Address of host to query using WebSockets. Set "false" if WebSockets are unaalable on the host.
 *   urlWget: Address of host to query using Wget.
 *   urlQueryListCallback: Can be either a callback function to generate query to send host or the list it's self.
 *   retryIn: Time in ms between repeat requests. ("0" means no repeat requests.)
 *   parseCallback: A callback function to reduce the returned data into a usable format.
 *   useCallback: A callback function to consume the returned data. */
Connection.prototype.getData = function (uniqueId, urlWs, urlWget, urlQueryListCallback, retryIn, parseCallback, useCallback) {
    'use strict';

    if(typeof this.connectionsInProgres[uniqueId] === 'undefined'){
        // first time running this connection uniqueId.
        this.connectionsInProgres[uniqueId] = false;
        this.successCounter[uniqueId] = 5;
    }

    if(this.connectionsInProgres[uniqueId] === true){
        // This connection has not finished and cleared flag. Timeout condition.
        this.getDataFail(uniqueId);
    }
    this.connectionsInProgres[uniqueId] = true;


    // See if there is a timer for this event already and clear it if there is.
    if(typeof this.repeatTimers[uniqueId] !== 'undefined'){
        clearTimeout(this.repeatTimers[uniqueId]);
    }
    // Set a new timer if appropriate.
    if(retryIn > 0){
        this.repeatTimers[uniqueId] = setTimeout(function(){this.getData(uniqueId, urlWs, urlWget, urlQueryListCallback, retryIn, parseCallback, useCallback);}.bind(this), retryIn);
    }
    log(Object.keys(this.repeatTimers).length, 'Conections');

    var urlQueryList;
    if(typeof urlQueryListCallback === 'function'){
        urlQueryList = urlQueryListCallback();
    } else {
        urlQueryList = urlQueryListCallback;
    }

    // Now send the request for the data.
    if (this.tryWebSocket && (urlWs !== false) && ('WebSocket' in window)){
        this.getDataWs(uniqueId, urlWs, urlQueryList, parseCallback, useCallback);
    } else{
        this.getDataWget(uniqueId, urlWget, urlQueryList, parseCallback, useCallback);
    }

    // If we haven't sucessfully received data for a while...
    if(this.successCounter[uniqueId] === 0){
        // switch off dial.
        useCallback(false);

        // Abuse this counter so we don't swap hosts every failure.
        this.successCounter[uniqueId] = 5;

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

    if(typeof this.repeatTimers[uniqueId] !== 'undefined'){
        return this.repeatTimers[uniqueId];
    }
};

Connection.prototype.getDataWs = function (uniqueId, urlWs, urlQueryList, parseCallback, useCallback) {
    'use strict';
    log(Object.keys(this.sockets).length, 'WebSockets');

    this.swapServer(urlWs);

    var retVals = {};
    var urlDomainWs = urlWs.host + ':' + urlWs.port + urlWs.path;
    var socket = this.getSocket(uniqueId, urlDomainWs, urlQueryList);

    socket.onopen = function() {
        this.send(socket, urlQueryList);
    }.bind(this);

    socket.onmessage = function(message) {
        if(parseCallback('ws', message.data, retVals) !== null){
            // data still arriving and populating retVals.
        } else {
            // Empty message signifies end of reply.
            socket.replyCount += 1;
            if (socket.replyCount === urlQueryList.length){
                // All expected replies have been recieved.
                if (typeof useCallback !== 'undefined'){
                    useCallback(retVals);
                    this.getDataSuccess(uniqueId, useCallback);
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


Connection.prototype.getDataWget = function (uniqueId, urlWget, urlQueryList, parseCallback, useCallback) {
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
                this.getDataSuccess(uniqueId, useCallback);
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

Connection.prototype.sendData = function (uniqueId, urlWs, urlWget, dataList){
    'use strict';
    if (this.tryWebSocket && (urlWs !== false) && ('WebSocket' in window)){
        this.sendDataWs(uniqueId, urlWs, dataList);
    } else{
        this.sendDataWget(uniqueId, urlWget, dataList);
    }
};

Connection.prototype.sendDataWs = function (uniqueId, urlWs, dataList){
    'use strict';
    var urlDomainWs = urlWs.host + ':' + urlWs.port + urlWs.path;
    var socket = this.getSocket(uniqueId, urlDomainWs, dataList);
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

Connection.prototype.sendDataWget = function (uniqueId, urlWget, dataList){
    'use strict';
    // TODO implement retries on failure.

    var urlDomainWs = 'http://' + urlWget.host + ':' + urlWget.port + urlWget.path;

    console.log(urlDomainWs);

    var request = new XMLHttpRequest();
    request.onreadystatechange = function() { //Call a function when the state changes.
        if(request.readyState === 4 && request.status === 200) {
            console.log(request.responseText);
        } else if(request.readyState === 4) {
            // Since request.status !== 200,
            // this is an error.
            // Rather than handling the error here it is simpler to have a single failure timer that gets canceled on success (Still TODO.).
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
        'use strict';
        if(data === "[]"){
            return null;
        }
        try{
            data = JSON.parse(data);
        } catch(err){
            console.log("Error parsing JSON:");
            console.log(err);
            console.log(data);
            return null;
        }
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
                //console.log(label, key, val);
                if(typeof label === 'undefined'){
                    // Data is a list of (key,val).
                    retVals[key] = [val];
                } else {
                    // Data contains list of (label, key, val).
                    if(!(label in retVals)){
                        retVals[label] = [];
                    }
                    retVals[label][key] = [val];
                }
            }
            return retVals;
        } else {
            // haven't used this section so it is still un-tested.
            if(typeof data.data !== 'undefined'){
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
            console.log(retVals);
            return retVals;
        }
};

var parseDataAppEngine = function(type, data, retVals){
        'use strict';
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


function UserData(updateCallback){
    'use strict';
    this.updateCallback = updateCallback;    
    this.deviceList = {};
    this.userList = false;
    
    this.getData();
}


/* Get info on which users devices currently have DHCP leases. */
UserData.prototype.getData = function(){
    'use strict';
    var urlWs,
        urlWget,
        urlQueryList;

    // Get User info from AppEngine if we don't already have it.
    // Note that we only get this once. If a new user needs to be added to the system,
    // the web page must be re-loaded.
    if(this.userList === false){
        urlWs = false;
        urlWget = {'host': 'home-automation-7.appspot.com',
                   'port': '80',
                   'path': '/listUsers/'};
        urlQueryList = [{'unused': '0'}];
        nwConnection.getData('UserData.users', urlWs, urlWget, urlQueryList, 1000, parseDataAppEngine, this.parseDataUsers.bind(this));
    }

    // Get all MAC Address and IP Address mappings in the last hour from server.
    urlWs = {'host': serverFQDN,
             'port': serverCubeMetricPort,
             'path': '/cube-metric-ws/1.0/event/get'};
    urlWget = {'host': serverFQDN,
               'port': serverCubeMetricPort,
               //'path': '/cube-metric/1.0/event/get'};
               'path': '/data'};
    //var urlQueryListCallback = function(){
        //var dateStartRead = new Date();
        //dateStartRead.setMinutes(dateStartRead.getMinutes() - 60*timeWindow);
        //dateStartRead = dateStartRead.toISOString();

        //var dateStop = new Date();
        //dateStop.setMinutes(dateStop.getMinutes() +60);
        //dateStop = dateStop.toISOString();

        //return [{'expression': 'sensors(label,key,val).eq(label,\'net_clients\')',
        //        'start': dateStartRead,
        //        'stop': dateStop }];
    //    return [{'type': 'sensors', 'age': activeClientTimeout, 'data':'{"label": "net_clients"}'}];
    //};

    nwConnection.getData('UserData.devices', urlWs, urlWget, [{'type': 'sensors', 'age': activeClientTimeout, 'data':'{"label": "net_clients"}'}],
            1000, parseDataCube, this.parseDataDevices.bind(this));
};

/* Callback function to parse data retreived by this.getData(). 
 * This callback deals with data from AppEngine and maps userId to name and picture.*/
UserData.prototype.parseDataUsers = function(data){
    'use strict';
    if(typeof data === "boolean"){
        return;
    }

    //console.log('UserData.parseDataUsers', data);
    var key;

    if(typeof this.parseDataUsersFailcounter === 'undefined'){
        this.parseDataUsersFailcounter = 0;
    }

    if(data === {}){
        this.parseDataUsersFailcounter += 1;
    }
    
    if(this.parseDataUsersFailcounter >= 5){
        nwConnection.clearRepeatTimers('UserData.users');
        this.parseDataUsersFailcounter = 0;
    }

    for(key in data){
        if(key === 'users'){
            nwConnection.clearRepeatTimers('UserData.users');
            this.parseDataUsersFailcounter = 0;
            this.userList = data.users;
        } else {
            // Got data from same WebSocket (hence this callback) but query does not match.
            this.parseDataUsersFailcounter += 1;
        }
    }

    this.combineData();    
};

/* callback function to parse data retreived by this.getData(). */
UserData.prototype.parseDataDevices = function(data){
    'use strict';
    if(typeof data === "boolean"){
        return;
    }

    //console.log('UserData.parseDataDevices', data);
    var key;
    var queryList = [];
    var macAddr;

    if(typeof data === 'boolean'){
        // We don't care about the bool indicators of network sucess here.
        return;
    }

    if(typeof this.parseDataDevicesFailcounter === 'undefined'){
        this.parseDataDevicesFailcounter = 0;
    }

    if(data === {}){
        this.parseDataDevicesFailcounter += 1;
    }

    if(this.parseDataDevicesFailcounter >= 5){
        nwConnection.clearRepeatTimers('UserData.devices');
        this.parseDataDevicesFailcounter = 0;
    }

//    var dateStart = 0;
//    var dateStop = new Date();
//    dateStop.setMinutes(dateStop.getMinutes() +60);     // End time set for 1 hour in the future.
//    dateStop = dateStop.toISOString();

    this.deviceList = {};
    for(key in data){
        if(key === 'net_clients'){
            // Received macAddr & IPAddr from server.
            nwConnection.clearRepeatTimers('UserData.devices');
            this.parseDataDevicesFailcounter = 0;
            for(macAddr in data.net_clients){
                if(!(macAddr in this.deviceList)){
                    this.deviceList[macAddr] = {ip: data.net_clients[macAddr].slice(-1),
                        description: '',
                        userId: '',
                        userName: '',
                        userUrl: ''};
                } else {
                    this.deviceList[macAddr].ip = data.net_clients[macAddr].slice(-1);
                }
                // Since we have a new MacAddr, let's look up if we have stored any information about it.
//                queryList.push({'expression': 'configuration(label,key,val).eq(key,\'' + macAddr + '\')',
//                                  'start': dateStart,
//                                  'stop': dateStop,
//                                  'limit': 2,
//                                  'sort': 'time' });
                queryList.push({'type': 'configuration', 'data':'{"key": ' + macAddr + '}'});
            }
        } else {
            // Got data from same WebSocket (hence this callback) but query does not match.
            this.parseDataDevicesFailcounter += 1;
        }
    }

    if(queryList.length !== 0){
        var urlWs = {'host': serverFQDN,
                 'port': serverCubeMetricPort,
                 'path': '/cube-metric-ws/1.0/event/get'};
        var urlWget = {'host': serverFQDN,
                   'port': serverCubeMetricPort,
//                   'path': '/cube-metric/1.0/event/get'};
                   'path': '/data'};                   
        nwConnection.getData('UserData.configuration', urlWs, urlWget, queryList, 1000, parseDataCube, this.parseDataConfig.bind(this));
    }

    this.combineData();
};

UserData.prototype.parseDataConfig = function(data){
    'use strict';
    if(typeof data === "boolean"){
        return;
    }

    //console.log('UserData.parseDataConfig', data);
    var macAddr,
        key;

    nwConnection.clearRepeatTimers('UserData.configuration');
    for(key in data){
        if(key === 'userId'){
            for(macAddr in data[key]){
                if(!(macAddr in this.deviceList)){
                    this.deviceList[macAddr] = {ip: '',
                        description: '',
                        userId: data[key][macAddr][0],
                        userName: '',
                        userUrl: ''};
                } else {
                    this.deviceList[macAddr].userId = data[key][macAddr][0];
                }
            }
        } else if(key === 'description'){
            for(macAddr in data[key]){
                if(!(macAddr in this.deviceList)){
                    this.deviceList[macAddr] = {ip: '',
                        description: data[key][macAddr][0],
                        userId: '',
                        userName: '',
                        userUrl: ''};
                } else {
                    this.deviceList[macAddr].description = data[key][macAddr];
                }
            }
        }
    }
    this.combineData();
};

/* combine data that may have been parsed by parseDataUsers, parseDataDevices or parseDataConfig */
UserData.prototype.combineData = function(){
    'use strict';

    var macAddr;
    // Add this.userList data to this.deviceList.
    for(macAddr in this.deviceList){
        var userId = this.deviceList[macAddr].userId;
        if(userId !== '' && this.userList !== false){
            if(this.deviceList[macAddr].userId in this.userList){
                this.deviceList[macAddr].userName = this.userList[userId].displayName;
                this.deviceList[macAddr].userUrl = this.userList[userId].image;
            }
        }
    }

    this.updateCallback();
};

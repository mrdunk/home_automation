/* global serverFQDN1 */
/* global serverFQDN2 */
/* global appEngineFQDN */
/* global Network */
/* exported GetAuthKey */


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

    if(returnedData.loginStatus && returnedData.loginStatus === true){
        console.log(returnedData.key, 'Auth');
        return returnedData.key;
    }

    window.location = returnedData.url;
}


function DataStore(){
    'use strict';
    this.allDataContainer = {};
    this.userDataContainer = {};
    this.callbackFunctions = [];
    this.additionalCallback = [];

    this.network = new Network();

    this.setupConnections();
}

DataStore.prototype.parseIncoming = function(incomingData, code){
    'use strict';
    //console.log("DataStore.parseIncoming", incomingData, code);
    if(code !== undefined && code !== 200){
        console.log("DataStore.parseIncoming ", incomingData, code);
        return;
    }

    if(incomingData === 'ok' && code === 200){
        // Incoming reply from a sucessfull POST.
        return;
    }

    var newObj = [];
    try{
        newObj = JSON.parse(incomingData);
        //console.log(newObj);
    } catch(e) {
        console.log(e, incomingData.length);
        return;
    }

    var i, j, type, key, label, val;

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
            type = newObj[i].type;
            key = newObj[i].data.key;
            label = newObj[i].data.label;
            val = newObj[i].data.val;
            if(!(key in this.allDataContainer)){
                this.allDataContainer[key] = {};
            }
            this.allDataContainer[key][label] = [val, Date.now()];

            if(type === 'configuration' && label === 'userId'){
                // Since we have set a new userId, we also need to update the other user attributes.
                if(this.userDataContainer[val]){
                    this.allDataContainer[key].displayName = [this.userDataContainer[val].displayName, Date.now()];
                    this.allDataContainer[key].image[0].url = this.userDataContainer[val].image;
                    this.allDataContainer[key].image[1] = Date.now();
                }
            }
        } else {
            // Presume data from AppEngine.
            // TODO ratify the 2 formats.

            // Populate the userDataContainer DB with all available data.
            this.userDataContainer[newObj[i].id] = {};
            if(newObj[i].image !== undefined){
                this.userDataContainer[newObj[i].id].image = newObj[i].image.url;
            }
            this.userDataContainer[newObj[i].id].displayName = newObj[i].displayName;
            //if(this.userDataContainer[newObj[i].id].home === undefined){
                this.userDataContainer[newObj[i].id].home = false;
            //}

            // Loop through network devices and cross reference about associated users.
            var TIMEOUT = 1000 * 60 * 5;  // 5 minutes in ms.
            for(j in this.allDataContainer){
                if('userId' in this.allDataContainer[j] && this.allDataContainer[j].userId[0] === newObj[i].id){
                    // Save to the regular DB.
                    this.allDataContainer[j].image = [newObj[i].image, Date.now()];
                    this.allDataContainer[j].displayName = [newObj[i].displayName, Date.now()];

                    // Also populate the userDataContainer DB with all available data.
                    if(!("description" in this.allDataContainer[j]) || this.allDataContainer[j].description[1] + TIMEOUT < Date.now()){
                        this.allDataContainer[j].description = ["", Date.now()];
                    }
                    if(!("net_clients" in this.allDataContainer[j]) || this.allDataContainer[j].net_clients[1] + TIMEOUT < Date.now()){
                        this.allDataContainer[j].net_clients = ["", Date.now()];
                    }

                    if(!("description" in this.userDataContainer[newObj[i].id])){
                        this.userDataContainer[newObj[i].id].description = [this.allDataContainer[j].description[0]];
                    } else if(this.userDataContainer[newObj[i].id].description !== this.allDataContainer[j].description[0]){ 
                        this.userDataContainer[newObj[i].id].description.push(this.allDataContainer[j].description[0]);
                    }
                    if(!("macAddr" in this.userDataContainer[newObj[i].id])){
                        this.userDataContainer[newObj[i].id].macAddr = [j];
                        this.userDataContainer[newObj[i].id].net_clients = [this.allDataContainer[j].net_clients[0]];
                    } else if(this.userDataContainer[newObj[i].id].macAddr.indexOf(j) < 0){
                        this.userDataContainer[newObj[i].id].macAddr.push(j);
                        this.userDataContainer[newObj[i].id].net_clients.push(this.allDataContainer[j].net_clients[0]);
                    }

                    if(this.allDataContainer[j].net_clients[0] !== "" && this.allDataContainer[j].net_clients[1] + TIMEOUT > Date.now()){
                        this.userDataContainer[newObj[i].id].home = true;
                    }
                } else if('userId' in this.allDataContainer[j] && this.allDataContainer[j].userId[0] ===""){
                    this.allDataContainer[j].image = [[], Date.now()];
                    this.allDataContainer[j].displayName = ["", Date.now()];
                }
            }
        }
    }
    
    //console.log(this.allDataContainer);
    //console.log(this.userDataContainer);

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
    //} else {
        //console.log(".");
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

    if(this.callbackFunctions.length){
        this.doCallbacks();
    }
};

DataStore.prototype.addCallback = function(callback){
    'use strict';
    this.callbackFunctions.push(callback);
    this.doCallbacks();
};


DataStore.prototype.setupConnections = function(){
    'use strict';

    // defines: 
    var DO_WEBSOCKET = true;
    var SKIP_WEBSOCKET = false;

    var serverHouse = [[serverFQDN1, "55555", DO_WEBSOCKET], [serverFQDN2, "55555", DO_WEBSOCKET]];
    var serverAppEngine = [[appEngineFQDN, "80", SKIP_WEBSOCKET]];

    var querysHouse = [['/data?type=configuration&data={"label":"userId"}', 30000],
                       ['/data?type=configuration&data={"label":"description"}', 30000],
                       ['/data?type=sensors&data={"label":"net_clients"}&age=300', 30000],
                       ['/data?type=userInput', 30000],
                       ['/data?type=output', 30000],
                       ['/data?type=sensors&data={"label":"1wire"}&age=300', 30000],
                       ['/cyclicDB_average_temp_1_week?', 600000],                      // 600000ms = 10 mins.
                       ['/cyclicDB_temp_setting_1_week?', 600000],                      // 600000ms = 10 mins.
                       ['/cyclicDB_heating_state_1_week?', 600000],                     // 600000ms = 10 mins.
                       ['/cyclicDB_whos_home_1_week?', 1800000],                        // 1800000ms = 30 mins.
                       ['/serverTime?', 30000],
                       ['/clientput?', 0]                                               // No repeate for POST data.
                      ];
    var querysAppEngine = [['/listUsers/?', 60000]];
    
    var q, s, query, fqdn, port, time, doWebsocket;
    for(q in querysHouse){
        query = querysHouse[q][0];
        time = querysHouse[q][1];
        for(s in serverHouse){
            fqdn = serverHouse[s][0];
            port = serverHouse[s][1];
            doWebsocket = serverHouse[s][2];
            this.network.registerQuery(query, fqdn, port, doWebsocket);
            this.network.registerCallback(query, this.parseIncoming.bind(this));
            if(time){
                this.network.setQueryInterval(query, time);
            }
        }
    }
    for(q in querysAppEngine){
        query = querysAppEngine[q][0];
        time = querysAppEngine[q][1];
        for(s in serverAppEngine){
            fqdn = serverAppEngine[s][0];
            port = serverAppEngine[s][1];
            doWebsocket = serverAppEngine[s][2];
            this.network.registerQuery(query, fqdn, port, doWebsocket);
            this.network.registerCallback(query, this.parseIncoming.bind(this));
            if(time){
                this.network.setQueryInterval(query, time);
            }
        }
    }
};

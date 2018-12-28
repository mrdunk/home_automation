/* global serverFQDN1 */
/* global serverFQDN2 */
/* global appEngineFQDN */
/* global Network */
/* exported GetAuthKey */

/* Get the auth key.
 * No point using the regular framework to get this key because nothing else will work without it.
 * We do a blocking wget for the key. */

// Time a device associated with a user can be inactive for before it is dismissed. (in ms)
var USER_TIMEOUT = 5 * 60 * 1000;

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
    } catch(err) {
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
    this.callbackFunctions = [];

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
        // Incoming reply from a successful POST.
        return;
    }

    var newObj = [];
    try{
        newObj = JSON.parse(incomingData);
        //console.log(newObj);
    } catch(e) {
        console.log(e, incomingData.length, incomingData);
        return;
    }

    var i, type, key, label, val, userId, macAddr;

    for(i in newObj){
        if(newObj[i] === 'invalid user'){
            console.log('Not logged in with registered Google account.');
            // TODO redirect to login page?
        } else if("data" in newObj[i] && "key" in newObj[i].data && "val" in newObj[i].data){
            // Data in format from Home server
            type = null;
            if(newObj[i].type){
                type = newObj[i].type;
            }
            key = newObj[i].data.key;
            label = newObj[i].data.label;
            val = newObj[i].data.val;
            if(!(key in this.allDataContainer)){
                this.allDataContainer[key] = {};
            }
            this.allDataContainer[key][label] = [val, Date.now()];

            if(type === 'user'){
                // Information about a in user.
                this.allDataContainer[key].type = 'user';
                if(newObj[i].data.host && newObj[i].data.host === 'appengine'){
                    // This is information about the logged in user from appengine. This should be cached on the home server.
                    var dataToSend = [{'type': 'user',
                                       'data': {'key': key,
                                                'label': label,
                                                'val': val}}];
                    this.network.put(JSON.stringify(dataToSend), null);
                }

                // Loop through associated devices and decide if the user is home.
                this.allDataContainer[key].home = false;
                for(macAddr in this.allDataContainer[key].devices){
                    if(this.allDataContainer[macAddr] && this.allDataContainer[macAddr].net_clients &&
                            this.allDataContainer[macAddr].net_clients[1] + USER_TIMEOUT > Date.now()){
                        this.allDataContainer[key].home = true;
                    }
                }
            } else if(type === 'sensors'){
                this.allDataContainer[key].type = label;
            }

            if(label === 'net_clients' && val !== ''){
                // An active device on the network with DHCP lease.
                // "key" will be the MAC address of the device.
                // "val" is the IP address.
                this.allDataContainer[key].type = 'net_client';

                if(this.allDataContainer[key].userId){
                    userId = this.allDataContainer[key].userId[0];
                    this.allDataContainer[userId].home = true;

                    if(!this.allDataContainer[userId].devices){
                        this.allDataContainer[userId].devices = {};
                    }
                    if(!this.allDataContainer[userId].devices[key]){
                        this.allDataContainer[userId].devices[key] = {};
                    }
                    this.allDataContainer[userId].devices[key].net_clients = val;
                }
            }

            if(type === 'configuration' && label === 'userId'){
                // This entry type links user to device.
                // "key" will be the MAC address of the device.
                // "val" will be the user ID.
                
                // Update the device entry making sure it contains information about the user.
                if(this.allDataContainer[val]){
                    if(val && this.allDataContainer[val].displayName){
                        this.allDataContainer[key].displayName = this.allDataContainer[val].displayName;
                    } else {
                        delete this.allDataContainer[key].displayName;
                    }
                }
                if(this.allDataContainer[val]){
                    if(val && this.allDataContainer[val].image){
                        this.allDataContainer[key].image = this.allDataContainer[val].image;
                    } else {
                        delete this.allDataContainer[key].image;
                    }
                }

                // Update the user entry making sure it contains information about all devices.
                if(!this.allDataContainer[val]){
                    this.allDataContainer[val] = {};
                }
                if(!this.allDataContainer[val].devices){
                    this.allDataContainer[val].devices = {};
                }
                if(!this.allDataContainer[val].devices[key]){
                    this.allDataContainer[val].devices[key] = {};
                }
                if(this.allDataContainer[key] && this.allDataContainer[key].description){
                    this.allDataContainer[val].devices[key].description = this.allDataContainer[key].description[0];
                }
                if(this.allDataContainer[key] && this.allDataContainer[key].net_clients){
                    this.allDataContainer[val].devices[key].net_clients = this.allDataContainer[key].net_clients[0];
                }

                // Make sure no other user is associated with this MAC address.
                for(userId in this.allDataContainer){
                    if(this.allDataContainer[userId].type === 'user' && 
                            userId !== val &&
                            this.allDataContainer[userId].devices &&
                            key in this.allDataContainer[userId].devices){
                        delete this.allDataContainer[userId].devices[key];
                    }
                }
            }

            if(type === 'configuration' && label === 'description'){
                // This entry type defines a device description.
                // "key" will be the MAC address of the device.
                // "val" will be the new description.
                this.allDataContainer[key].type = 'net_client';

                if(this.allDataContainer[key].userId){
                    userId = this.allDataContainer[key].userId[0];
                    for(macAddr in this.allDataContainer[key].devices){
                        if(macAddr === key){
                            if(!this.allDataContainer[userId].devices[key]){
                                this.allDataContainer[userId].devices[key] = {};
                            }
                            this.allDataContainer[userId].devices[key].description = val;
                        }
                    }
                }
            }
        }
    }
    
    this.doCallbacks();
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
                    if(this.callbackFunctions[callback]){
                        this.callbackFunctions[callback]();
                    }
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
                       ['/data?type=user', 30000],
                       ['/cyclicDB_average_temp_1_week?', 600000],      // 600000ms = 10 mins.
                       ['/cyclicDB_temp_setting_1_week?', 600000],      // 600000ms = 10 mins.
                       ['/cyclicDB_heating_state_1_week?', 600000],     // 600000ms = 10 mins.
                       ['/cyclicDB_whos_home_1_week?', 1800000],        // 1800000ms = 30 mins.
                       ['/serverTime?', 30000],
                       ['/clientput?', 0]                               // No repeat for POST data.
                      ];
    var querysAppEngine = [['/who/?', 60*60*1000],                      // 1 hour.
                           //['/listUsers/?', 2*60*1000],
                           ];
    
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

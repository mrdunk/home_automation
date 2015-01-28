/* global AuthKey */

/* jshint latedef:nofunc */


function Network(){
    'use strict';

    this.ws = new WS();
    this.http = new HTTP();
}

Network.prototype.registerQuery = function(query, server, port, allowWebsockets){
    'use strict';

    if(allowWebsockets){
        this.ws.registerQuery(query, server, parseInt(port) +1);
    }
    this.http.registerQuery(query, server, port);
};

Network.prototype.get = function(query){
    'use strict';

    this.ws.callbacksFail[query] = [function httpGetCallback(){this.http.get(query);}.bind(this)];
    this.ws.get(query);
};

/* Make query lookup happen at a regular interval. */
Network.prototype.setQueryInterval = function(query, time){
    'use strict';

    setInterval(function(){this.get(query);}.bind(this), time);

    // Also do this once now.
    this.get(query);
};


function WS(){
    'use strict';
    this.querys = {};
    this.RETRY_TIME = 1000;     // 1000ms.
    this.NUMBER_RETRYS = 3;

    this.callbacksSucess = {};
    this.callbacksFail = {};
}

WS.prototype.registerQuery = function(query, server, port){
    'use strict';
    if(!this.querys[query]){
        this.querys[query] = [];
    }
    this.querys[query].push({ws: null,
                            time: Date.now() -1,
                            server: server,
                            port: port});
};

/* This method will attempt to open a WebSocket or use an already open one if it exists.
 * Args:
 *   query: A string containing the data to send down the Websocket. 
 *          This is also the primary key for the querys object.
 *   retryCount: In the event a connection is closing as soon as it opens,
 *          this counter stops too many re-trys. */
WS.prototype.get = function(query, retryCount){
    'use strict';
    //console.log('WS.get('+query+', '+retryCount+')');

    if(!this.querys[query]){
        // query not registered.
        this.onFail(query);
        return;
    }

    if(!retryCount){
        retryCount = 0;
    }

    var oldestTimestamp = Date.now();
    var oldestWSPointer = null;
    var websocket;
    for(var q in this.querys[query]){
        websocket = this.querys[query][q];
        if(websocket.ws && websocket.ws.readyState === websocket.ws.OPEN){
            // Websocket is open.
            //console.log('WS.get('+query+', '+retryCount+')', websocket.server, websocket.port);
            this.useOpenSocket(websocket.ws, query);
            return;
        //} else if(websocket.ws && 
        //        (websocket.ws.readyState === websocket.ws.CONNECTING || 
        //         websocket.ws.readyState === websocket.ws.CLOSING)){
            // This Websocket is between states.
            // We don't realy need to do anything here as this method will get called again 
            // on OPEN.
        } else if(!websocket.ws || websocket.ws.readyState === null || 
                websocket.ws.readyState === websocket.ws.CLOSED){
            // Websocket not initialised or closed.
            // Let's see if it's the one that's been inactive longest so we can try to open it.
            if(websocket.time < oldestTimestamp){
                oldestTimestamp = websocket.time;
                oldestWSPointer = q;
            }
        }
    }

    if(retryCount++ >= this.NUMBER_RETRYS || oldestWSPointer === null){
        this.onFail(query);
        return;
    }

    // Open a websocket to the connection that has been inactive the longest.
    this.querys[query][oldestWSPointer].ws = 
        this.openSocket(this.querys[query][oldestWSPointer].server, 
                this.querys[query][oldestWSPointer].port, query);
    this.querys[query][oldestWSPointer].time = Date.now();

    // Now schedule coming back here to see if it opened.
    window.setTimeout(function ws_retry_timer(){
        this.get(query, retryCount);
    }.bind(this), this.RETRY_TIME);
};

WS.prototype.useOpenSocket = function(websocket, query){
    'use strict';
    //console.log('WS.useOpenSocket()');
    websocket.send(query + "&key=" +  AuthKey);
};

WS.prototype.openSocket = function(hostname, port, query){
    'use strict';
    console.log('WS.openSocket('+hostname+', '+port+')');

    var websocket;
    try {
        websocket = new WebSocket("ws://" + hostname + ":" + port + '/get');
        websocket.onopen = function(evt) { this.onOpen(evt, query); }.bind(this);
        //websocket.onclose = function(evt) { this.onClose(evt); }.bind(this);
        websocket.onmessage = function(evt) { this.onMessage(evt, query); }.bind(this);
        //websocket.onerror = function(evt) { this.onError(evt); }.bind(this);
    }catch(e){
        console.log(e);
    }

    return websocket;
};

WS.prototype.onOpen = function(evt, query){
    'use strict';
    //console.log("WS.onOpen", evt);

    // Whenever a WebSocket opens, do something with it.
    this.get(query);
};

/*WS.prototype.onClose = function(evt){
    'use strict';
    console.log("WS.onClose", evt);
};*/

WS.prototype.onMessage = function(evt, query){
    'use strict';
    //console.log("WS.onMessage", evt.data, evt);
    this.onSucess(query);
};

/*WS.prototype.onError = function(evt){
    'use strict';
    console.log("WS.onError", evt.data);
};*/

WS.prototype.onSucess = function(query){
    'use strict';
    console.log("WS.onSucess");

    if(this.callbacksSucess[query]){
        for(var callback in this.callbacksSucess[query]){
            this.callbacksSucess[query][callback](query);
        }
    }

};

WS.prototype.onFail = function(query){
    'use strict';
    console.log("WS.onFail", this.callbacksFail, query);

    if(this.callbacksFail[query]){
        for(var callback in this.callbacksFail[query]){
            this.callbacksFail[query][callback](query);
        }
    }
};





function HTTP(){
    'use strict';
    this.querys = {};
    this.RETRY_TIME = 1000;     // 1000ms.
    this.NUMBER_RETRYS = 3;

    this.callbacksSucess = {};
    this.callbacksFail = {};
}

/* Register a server that should be able to respond to a paticular query.
 * Args: 
 *   query: A string containing the data to send as arguments on the path. 
 *          This is also the primary key for the querys object.
 *   server: FQDN of the target server.
 *   port: Port number of listening http server. */
HTTP.prototype.registerQuery = function(query, server, port){
    'use strict';
    if(!this.querys[query]){
        this.querys[query] = {attemptNumber: 0,
                              successNumber: -1,
                              serverList: []};
    }
    this.querys[query].serverList.push({time: Date.now() -1,
                                        server: server,
                                        port: port});
};

/* Send query to ione of the registered HTTP server.
 * Args:
 *   query: A string containing the data to send as arguments on the path. 
 *          This is also the primary key for the querys object.
 *   retryCount: In the event a connection is closing as soon as it opens,
 *          this counter stops too many re-trys. */
HTTP.prototype.get = function(query, retryCount){
    'use strict';

    if(!this.querys[query]){
        // query not registered.
        return;
    }

    if(!retryCount){
        retryCount = 1;
    }

    var attemptNumber = this.querys[query].attemptNumber;
    var successNumber = this.querys[query].successNumber;

    if(attemptNumber !== successNumber){
        attemptNumber++;
        if(attemptNumber === this.querys[query].serverList.length){
            attemptNumber = 0;
        }
    }
    this.querys[query].attemptNumber = attemptNumber;

    this.getSingle(query, attemptNumber, 'GET', retryCount);
};

HTTP.prototype.getSingle = function(query, attemptNumber, method, retryCount){
    'use strict';
    var server = this.querys[query].serverList[attemptNumber].server;
    var port = this.querys[query].serverList[attemptNumber].port;

    console.log('HTTP.get(', query, server, port, method, ')');
    var xmlHttp = new XMLHttpRequest();

    if("withCredentials" in xmlHttp){
        // Firefox, Chrome, etc.
        xmlHttp.open(method, "http://" + server + ':' + port + query + "&key=" +  AuthKey, true );
        //console.log('FF, Chrome', 'XDomain');
    /* jshint wsh: true */
    } else if (typeof XDomainRequest !== "undefined") {
        // IE
        xmlHttp = new XDomainRequest();
        xmlHttp.open(method, "http://" + server + ':' + port + query + "&key=" +  AuthKey);
        //console.log('IE', 'XDomain');
    } else {
        // Otherwise, CORS is not supported by the browser.
        xmlHttp = null;
        console.log('Unsuported browser.');
    }
    xmlHttp.withCredentials = true;

    try {
        if(method.toUpperCase() === "POST"){
            xmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            //xmlHttp.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
        }
        xmlHttp.onloadend = function(evt) { this.onloadend(evt, query, attemptNumber, retryCount); }.bind(this);

        xmlHttp.send('test data');
    } catch(e){
        console.log(e);
    }
};

HTTP.prototype.onloadend = function(evt, query, attemptNumber, retryCount){
    'use strict';
    console.log("HTTP.onloadend", evt);
    
    var response = evt.target.response;
    var status = evt.target.status;
    console.log(response, status);

    if([200, 403].indexOf(status) >= 0){
        this.querys[query].successNumber = attemptNumber;
        this.onSucess(query);
    } else if(this.querys[query].successNumber === attemptNumber){
        // This query previously passed but now fails.
        this.querys[query].successNumber = -1;
        this.onFail(query, retryCount);
    } else {
        this.onFail(query, retryCount);
    }
};

HTTP.prototype.onSucess = function(query){
    'use strict';
    console.log("HTTP.onSucess");

    if(this.callbacksSucess[query]){
        for(var callback in this.callbacksSucess[query]){
            this.callbacksSucess[query][callback](query);
        }
    }
};

HTTP.prototype.onFail = function(query, retryCount){
    'use strict';
    console.log("HTTP.onFail");

    if(retryCount++ < this.NUMBER_RETRYS){
        window.setTimeout(function ws_retry_timer(){
            this.get(query, retryCount);
        }.bind(this), this.RETRY_TIME);
    }

    if(this.callbacksFail[query]){
        for(var callback in this.callbacksFail[query]){
            this.callbacksFail[query][callback](query);
        }
    }
};

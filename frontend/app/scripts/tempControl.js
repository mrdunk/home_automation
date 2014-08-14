
var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';
var serverFQDN = serverFQDN1;

//var serverCubeMetricPort = '1081';
//var serverCubeCollectorPort = '1080';
var serverCubeMetricPort1 = '80';
var serverCubeCollectorPort1 = '80';
var serverCubeMetricPort2 = '8080';
var serverCubeCollectorPort2 = '8080';
var serverCubeMetricPort = serverCubeMetricPort1;
var serverCubeCollectorPort = serverCubeCollectorPort1;

var timeWindow = 2;  // Period of history to average data over. (minutes)

var timeDataUpdateWget = 500;  // How often to query server for data for regular wget. (ms)
var timeDataUpdateWs = 100;  // How often to query server for data for websocket. (ms)
var timeDataUpdateProblems = 10000;  // Extend timeouuts when we are haing connection problems.

var failuresBeforeSwapHostName = 10;

var tempSensorList = ['00000536d60c', '0000053610c1'];

var useWebSocket = true;
//var useWebSocket = false;

// Pick a speed to run at.
var timeDataUpdate;
var setUpdateTime = function(newTime){
	'use strict';

	// If timeDataUpdate is undefined, this is the first time we've run this function. set sensible defaults.
	if (typeof timeDataUpdate === 'undefined'){
		if (useWebSocket && ('WebSocket' in window)){
			timeDataUpdate = timeDataUpdateWs;
		} else {
			timeDataUpdate = timeDataUpdateWget;
		}
	}

	if (typeof newTime === 'undefined'){
		if (useWebSocket && ('WebSocket' in window)){
			if(timeDataUpdate > timeDataUpdateWs){
				timeDataUpdate = timeDataUpdate - 10;
			}
		} else {
			if(timeDataUpdate > timeDataUpdateWget){
				timeDataUpdate = timeDataUpdate - 10;
			}
		}
	} else {
		if(timeDataUpdate < newTime){
			timeDataUpdate = timeDataUpdate + 50;
		}
	}

	if(typeof dataUpdateInterval !== 'undefined'){
		window.clearInterval(dataUpdateInterval);
		setDataUpdateInterval();		
	}
	log(timeDataUpdate, 'timeDataUpdate');
};

var logDict = {};
var log = function(text, key, clear){
	'use strict';
        var logDiv = document.getElementById('log');
        if (typeof key === 'undefined'){
                key = 'freeform';
        }
        if (typeof clear === 'undefined'){
                clear = true;
        }

        logDict[key] = String(text);
        for (var k in logDict){

                var keyDiv = document.getElementById('log_' + k);
                if (keyDiv === null){
                        keyDiv = document.createElement('div');
                        keyDiv.id = 'log_' + k;
                        keyDiv.className = k;
                        logDiv.appendChild(keyDiv);
                }

                keyDiv.innerHTML = '<div style="border-width:1px;border-style:solid;background-color:#EEEEEE;width:20%;clear:both;float:left;">' + k +
                                   '</div><div style="border-width:1px;border-style:solid;background-color:#EEEEEE;width:80%;float:left;">' + logDict[k] + '</div>';
        }
};

var graphUpdateInterval, dataUpdateInterval;

var setDataUpdateInterval = function () {
        dataUpdateInterval = window.setInterval(function(){
                        data = getData(myTs.updateData.bind(myTs));
                        }, timeDataUpdate);
};


var graphUpdateInterval, dataUpdateInterval, myTs, myTs2;
window.onload = function () {
        'use strict';
        log('window.onload');
	log(location.hash, 'hash');

	setUpdateTime();
        
	var data = getData();

        // Creates canvas 320 × 200 at 100, 200
        var paper = new Raphael(document.getElementById('paper'), "100%", 400);

        myTs = new TemperatureSensor('Temperature', paper, tempSensorList, 75, 200, 50, 7, 9, 0, 40, timeDataUpdate, sendData);
        myTs2 = new TemperatureSensor('Test dial', paper, tempSensorList, 230, 200, 50, 7, 9, 0, 40);

        graphUpdateInterval = window.setInterval(function(){
		// TODO: onlu update if dirty.
                myTs.updateGraph();
                myTs2.updateGraph();
        }, 50);

	setDataUpdateInterval();
};

var connectionFailCounter = failuresBeforeSwapHostName;
var connectionSucess = function(){
	connectionFailCounter = failuresBeforeSwapHostName;
        log(connectionFailCounter, 'connectionFailCounter');
};
var connectionFail = function(){
	setUpdateTime(timeDataUpdateProblems);
	
	if(connectionFailCounter > 0){
		connectionFailCounter = connectionFailCounter -1;
	        log(connectionFailCounter, 'connectionFailCounter');
	} else {
		if(serverFQDN === serverFQDN1){
                        serverCubeMetricPort = serverCubeMetricPort2;
                        serverCubeCollectorPort = serverCubeCollectorPort2;
			serverFQDN = serverFQDN2;
		} else {
			serverCubeMetricPort = serverCubeMetricPort1;
			serverCubeCollectorPort = serverCubeCollectorPort1;
			serverFQDN = serverFQDN1;
		}
		log(serverFQDN + ':' + serverCubeMetricPort, 'Hostname');
		console.log('Hostname:', serverFQDN + ':' + serverCubeMetricPort);

		for(var socketKey in sockets){
			console.log('closing', socketKey);
			sockets[socketKey].close();
			delete sockets[socketKey];
		}
	}
};

// This holds a dict of webbsocket.
var sockets = {};

var getSocket = function(url){

	var authKey = location.hash;
	if (authKey === ''){
		authKey = none;
	}

	// Try to use existing WebSocket.
	if ((typeof sockets[url] === 'undefined') || (sockets[url].readyState !== 1)){
		sockets[url] = new WebSocket('ws://' + serverFQDN + ':' + serverCubeMetricPort + url, authKey);
	} else {
		sockets[url].onopen();
	}

	return sockets[url];
};

var postData;  // Some scope wierdness was causing postData to not go out of scope when declared within sendData().
var sendData = function (temperature, label){
        'use strict';
	var id = new Date().getTime()/(1000*600);
	id = Math.round(id);
	postData = {'type':'userInput', 'id':id, 'data':{'label':'test_label', 'auth_key':'test_key', 'key':'set_' + label, 'val':temperature}};

	if (useWebSocket && ('WebSocket' in window)){
		var socket = getSocket('/cube-collect-ws/1.0/event/put');
		socket.onopen = function() {
			console.log(postData);
			socket.send(JSON.stringify(postData));
		};
		socket.onerror = function(error) {
			console.log("error", error);
		};
		socket.onmessage = function(message) {
			console.log('message', message);
		};
	} else {

		var url = 'http://' + serverFQDN + ':' + serverCubeCollectorPort + '/cube-collect/1.0/event/put';
		console.log(url);

		var request = new XMLHttpRequest();
		request.onreadystatechange = function() { //Call a function when the state changes.
			if(request.readyState === 4 && request.status === 200) {
				console.log(request.responseText);
			}
		};
		var async = true;
		var method = 'POST';
		request.open(method, url, async);
		request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded,X-Key=' + location.hash);
		console.log(JSON.stringify(postData));
		request.send(JSON.stringify([postData]));
	}

};

var getData = function (callback) {
        'use strict';

        var dateStartRead = new Date();
        dateStartRead.setMinutes(dateStartRead.getMinutes() - timeWindow);
        dateStartRead = dateStartRead.toISOString();

        var dateStartSet = new Date();
        dateStartSet.setHours(dateStartSet.getHours() - 24);
        dateStartSet = dateStartSet.toISOString();

        var dataStop = new Date();
	dataStop.setMinutes(dataStop.getMinutes() +60);
	dataStop = dataStop.toISOString();


        var retVals = {};
	var countSocketReplies = 0;

	var connectionTimeout = setTimeout(function(){connectionFail();}, timeDataUpdate*10);


        if (useWebSocket && ('WebSocket' in window)){
                /* WebSocket is supported.*/
                log(Object.keys(sockets).length, 'WebSockets');

		var socket = getSocket('/cube-metric-ws/1.0/event/get');

                socket.onopen = function() {
                        socket.send(JSON.stringify({
                                                'expression': 'sensors(key,val).eq(label,\'1wire\')',
                                                'start': dateStartRead,
                                                'stop': dataStop
                                                }));
			socket.send(JSON.stringify({
                                                'expression': 'userInput(key,val).eq(key,\'set_Temperature\')',
                                                'start': dateStartSet,
                                                'stop': dataStop,
						'limit': 1
                                                }));
                };
                socket.onmessage = function(message) {
			var retValsTotal = {};
			var retValsCount = {};

                        if(JSON.parse(message.data) !== null){
                                // data still arriving.
                                var key = JSON.parse(message.data).data.key;
                                var val = parseFloat(JSON.parse(message.data).data.val);
                                if(!(key in retValsTotal)){
                                        retValsTotal[key] = val;
                                        retValsCount[key] = 1;
                                } else {
                                        retValsTotal[key] += val;
                                        retValsCount[key] += 1;
                                }
                                retVals[key] = [retValsTotal[key] / retValsCount[key], retValsCount[key]];
                        } else {
				// Empty message signifies end of reply.
				countSocketReplies += 1;
				if (countSocketReplies === 2){
					// All expected replies have been recieved.
					if (typeof callback !== 'undefined'){
						setUpdateTime();  // Restore normal timeouts incase they were extended due to failed transmissions.
						clearTimeout(connectionTimeout);
						connectionSucess();
						callback(retVals);
					}
				}
                        }
                };
		socket.onerror = function(error){
			clearTimeout(connectionTimeout);
			console.log('*', error);

			// Remove this websocket from the list.
			delete sockets['/cube-metric-ws/1.0/event/get'];

			// Since we have canceled the connectionTimeout, we need to try the alternative host manually.
			connectionFail();
			
			// We still want to do the callback so depandants know that no data is being received.
			if (typeof callback !== 'undefined'){
				callback({});
			}
		};
        } else {
                /*WebSockets are not supported. Try a fallback method like long-polling etc*/
                log('un-supported', 'WebSocket');

                var url1 = 'http://' + serverFQDN + ':' + serverCubeMetricPort ;
                url1 += '/cube-metric/1.0/event/get?expression=sensors(key,val).eq(label,\'1wire\')&start=' + dateStartRead + '&stop=' + dataStop ;
		var url2 = 'http://' + serverFQDN + ':' + serverCubeMetricPort ;
                url2 += '/cube-metric/1.0/event/get?expression=userInput(key,val).eq(key,\'set_Temperature\')&start=' + dateStartSet + '&stop=' + dataStop ;
                url2 += '&limit=1';
                //log(url2);

		var httpRequest = function(url){
			var request = new XMLHttpRequest();
			request.onreadystatechange = function() {//Call a function when the state changes.
				if(request.readyState === 4 && request.status === 200) {
		                        setUpdateTime();  // Restore normal timeouts incase they were extended due to failed transmissions.
					connectionSucess();
					clearTimeout(connectionTimeout);

					var returnedData = request.responseText;

					var retValsTotal = {};
					var retValsCount = {};
					returnedData = JSON.parse(returnedData);
					//console.log(returnedData);
					for (var dataKey in returnedData){
						var item = returnedData[dataKey];
						var key = item.data.key;
						var val = parseFloat(item.data.val);
						if(!(key in retValsTotal)){
							retValsTotal[key] = val;
							retValsCount[key] = 1;
						} else {
							retValsTotal[key] += val;
							retValsCount[key] += 1;
						}
						retVals[key] = [retValsTotal[key] / retValsCount[key], retValsCount[key]];
					}
				} else if(request.readyState === 4 && request.status === 0) {
					// error
					clearTimeout(connectionTimeout);
					connectionFail();
				}
				// either data has arrived or there was a problem so execute callback function.
				if (typeof callback !== 'undefined'){
					callback(retVals);
				}
			};
			var async = true;
			var method = 'GET';
			request.open(method, url, async);
			
			// We piggyback our authentication key on the Content-Type as Chrome does not allow us to modify any other headers.
                        request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8,X-Key=' + location.hash);
			
			request.send(null);
		};
		httpRequest(url1);
		httpRequest(url2);
        }
        return retVals;
};


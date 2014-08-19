
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

var failuresBeforeSwapHostName = 5;

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
		if(timeDataUpdate > timeDataUpdateWget){
			timeDataUpdate = timeDataUpdate - 10;
		}
	} else {
		if(timeDataUpdate < newTime){
			timeDataUpdate = timeDataUpdate + 50;
		}
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

var setDataUpdateInterval = function (callbackFunction, callbackPeramiter) {
        'use strict';
	if(typeof dataUpdateInterval !== 'undefined'){
                window.clearInterval(dataUpdateInterval);
        }
        dataUpdateInterval = window.setInterval(function(){
                        callbackFunction(callbackPeramiter);
                        }, timeDataUpdate);
};


var graphUpdateInterval, dataUpdateInterval, myTs, myTs2, authKey;

window.onload = function () {
        'use strict';
        log('window.onload');
	log(location.hash, 'hash');
	authKey = getAuthKey();
	
};

window.onhashchange = function () {
	'use strict';
	console.log(location.hash);

	window.clearInterval(dataUpdateInterval);
	window.clearInterval(graphUpdateInterval);

	if(location.hash === '#control'){
		pageDials();
	} else if(location.hash === '#config'){
		new PageConfig();
	} else if(location.hash === '#graphs'){
                //pageGraphs();
        } else if(location.hash.indexOf('key=') === 1){
		authKey = getAuthKey();
	}
};

var pageDials = function () {
        'use strict';
	console.log('pageDials');
	setUpdateTime();
        
	var data = getTemperatureData();

        // Creates canvas 320 × 200 at 100, 200
	document.getElementById('paper').innerHTML = "";
        var paper = new Raphael(document.getElementById('paper'), "100%", 400);

        myTs = new TemperatureSensor('Temperature', paper, tempSensorList, 75, 200, 50, 7, 9, 0, 40, timeDataUpdate, sendData);
        myTs2 = new TemperatureSensor('Test dial', paper, tempSensorList, 230, 200, 50, 7, 9, 0, 40);

        graphUpdateInterval = window.setInterval(function(){
		// TODO: only update if dirty.
                myTs.updateGraph();
                myTs2.updateGraph();
        }, 50);

	setDataUpdateInterval(getTemperatureData, myTs.updateData.bind(myTs));
};

var getAuthKey = function(){
        'use strict';
	// See if key has been sent as POST.
	if(location.hash.indexOf('key=') === 1){
		return location.hash.substr(5);
	}

	// Otherwise, get key from server.
	var returnedData;
	var url = '/authKey/';
	var request = new XMLHttpRequest();
	request.onreadystatechange = function() { //Call a function when the state changes.
		console.log(request.readyState, request.status);
		if(request.readyState === 4 && request.status === 200) {
			console.log(request.responseText);
			returnedData = request.responseText;
			returnedData = JSON.parse(returnedData);
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
		return returnedData.key;
	}

	window.location = returnedData.url;
};

var connectionFailCounter = 0;
var connectionSucess = function(callback){
        'use strict';
	// Enable dial.
	if (typeof callback !== 'undefined'){
		callback(true);
	}

	connectionFailCounter = failuresBeforeSwapHostName;
        log(connectionFailCounter, 'connectionFailCounter');
};

var connectionFail = function(callback){
        'use strict';
	setUpdateTime(timeDataUpdateProblems);
	
	if(connectionFailCounter > 0){
		connectionFailCounter = connectionFailCounter -1;
	        log(connectionFailCounter, 'connectionFailCounter');
	} else {
		// Disable dial.
		if (typeof callback !== 'undefined'){
			callback(false);
		}

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

var postData;  // Some scope wierdness was causing postData to not go out of scope when declared within sendData().
var sendData = function (temperature, label){
        'use strict';
	var id = new Date().getTime()/(1000*600);
	id = Math.round(id);
	postData = {'type':'userInput', 'id':id, 'data':{'label':'test_label', 'auth_key':'test_key', 'key':'set_' + label, 'val':temperature}};

	if (useWebSocket && ('WebSocket' in window)){
		console.log('WebSocket send');
		var socket = getSocket(serverFQDN + ':' + serverCubeMetricPort + '/cube-collect-ws/1.0/event/put', [postData]);
		socket.onopen = function() {
			getDataSend(socket, [postData]);
		};
		socket.onerror = function(error) {
			console.log("error", error);
		};
		socket.onmessage = function(message) {
			console.log('message', message);
		};
	} else {
                console.log('wget send');
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
		request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded,X-Key=' + authKey);
		console.log(JSON.stringify(postData));
		request.send(JSON.stringify([postData]));
	}

};

var getTemperatureData = function (callback) {
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

	var query;
	query = [{'expression': 'sensors(key,val).eq(label,\'1wire\')',
		  'start': dateStartRead,
		  'stop': dataStop
		 },
                 {'expression': 'userInput(key,val).eq(key,\'set_Temperature\')',
		  'start': dateStartSet,
		  'stop': dataStop,
		  'limit': 1
		 }];
	var urlWs = serverFQDN + ':' + serverCubeMetricPort + '/cube-metric-ws/1.0/event/get';
        var urlWget = serverFQDN + ':' + serverCubeMetricPort + '/cube-metric/1.0/event/get';
	getData(urlWs, urlWget, query, parseDataCube, callback);
};

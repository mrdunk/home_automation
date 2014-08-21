
var timeWindow = 2;  // Period of history to average data over. (minutes)

var timeDataUpdateWget = 500;  // How often to query server for data for regular wget. (ms)
var timeDataUpdateWs = 100;  // How often to query server for data for websocket. (ms)
var timeDataUpdateProblems = 10000;  // Extend timeouuts when we are haing connection problems.

var failuresBeforeSwapHostName = 5;



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


var graphUpdateInterval, dataUpdateInterval, authKey;


var pageDials = function () {
    'use strict';
    console.log('pageDials');
    setUpdateTime();

    var data = getTemperatureData();

    // Creates canvas 320 × 200 at 100, 200
    document.getElementById('paper').innerHTML = "";
    var paper = new Raphael(document.getElementById('paper'), "100%", 400);

    var myTs = new TemperatureSensor('Temperature', paper, tempSensorList, 75, 200, 50, 7, 9, 0, 40, timeDataUpdate, sendData);
    var myTs2 = new TemperatureSensor('Test dial', paper, tempSensorList, 230, 200, 50, 7, 9, 0, 40);

    graphUpdateInterval = window.setInterval(function(){
        // TODO: only update if dirty.
        myTs.updateGraph();
        myTs2.updateGraph();
    }, 50);

    setDataUpdateInterval(getTemperatureData, myTs.updateData.bind(myTs));
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
		var socket = getSocket(serverFQDN + ':' + serverCubeMetricPort + '/cube-collect-ws/1.0/event/put');//, [postData]);
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

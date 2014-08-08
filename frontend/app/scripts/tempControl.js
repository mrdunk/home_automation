'use strict';

var serverFQDN = '192.168.192.254';
//var serverFQDN = 'peeping.toythieves.com'
var serverCubeMetricPort = '1081';
var serverCubeCollectorPort = '1080';
var timeWindow = 2;  // Period of history to average data over. (minutes)
var timeDataUpdate = 6000;  // How often to query server for data. (ms)
var tempSensorList = ['00000536d60c', '0000053610c1'];


var logDict = {};
var log = function(text, key, clear){
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

window.onload = function () {
        log('window.onload');

        var data = getData();

        // Creates canvas 320 × 200 at 100, 200
        var paper = new Raphael(document.getElementById('paper'), "100%", 400);

        var myTs = new TemperatureSensor('Temperature', paper, tempSensorList, 70, 200, 50, 7, 9, 0, 40, sedData);
        var myTs2 = new TemperatureSensor('Test dial', paper, tempSensorList, 250, 200, 80, 10, 12, 0, 50);

        window.setInterval(function(){
                myTs.updateGraph();
                myTs2.updateGraph();
                //console.log(data);
        }, 50);

        window.setInterval(function(){
//          console.log(data);
        }, 1000);

        window.setInterval(function(){
            data = getData(myTs.updateData.bind(myTs));
//          console.log(data);
        }, timeDataUpdate);

};

var sedData = function (temperature, label){
	var url = 'http://' + serverFQDN + ':' + serverCubeCollectorPort + '/1.0/event/put';

	var postData = [{'type':'userInput', 'data':{'label':'test_label', 'auth_key':'test_key', 'key':'set_' + label, 'val':temperature}}];
	postData = JSON.stringify(postData);
	console.log(postData);

	var request = new XMLHttpRequest();
	request.onreadystatechange = function() { //Call a function when the state changes.
		if(request.readyState === 4 && request.status === 200) {
			console.log(request.responseText);
		}
	};
	var async = true;
	var method = 'POST';
	request.open(method, url, async);
	request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
	request.send(postData);

};


var socket;

var getData = function (callback) {
        var useWebSocket = true;

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

        if (useWebSocket && ('WebSocket' in window)){
                /* WebSocket is supported.*/
                log('supported', 'WebSocket');

		// Try to use existing WebSocket.
		if ((typeof socket === 'undefined') || (socket.readyState !== 1)){
			socket = new WebSocket('ws://' + serverFQDN + ':' + serverCubeMetricPort + '/1.0/event/get');
		} else {
			socket.onopen();
		}

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
					//socket.close();
					if (typeof callback !== 'undefined'){
						callback(retVals);
					}
				}
                        }
                };
		socket.onerror = function(error){
			console.log(error);
			if (typeof callback !== 'undefined'){
				callback({});
			}
		};
		socket.onclose = function()
		{
			//if (typeof callback !== 'undefined'){
			//	callback(retVals);
			//}
		};
        } else {
                /*WebSockets are not supported. Try a fallback method like long-polling etc*/
                log('un-supported', 'WebSocket');

                var url1 = 'http://' + serverFQDN + ':' + serverCubeMetricPort ;
                url1 += '/1.0/event/get?expression=sensors(key,val).eq(label,\'1wire\')&start=' + dateStartRead + '&stop=' + dataStop ;
		var url2 = 'http://' + serverFQDN + ':' + serverCubeMetricPort ;
                url2 += '/1.0/event/get?expression=userInput(key,val).eq(key,\'set_Temperature\')&start=' + dateStartSet + '&stop=' + dataStop ;
                url2 += '&limit=1';
                //log(url2);

		var httpRequest = function(url){
			var request = new XMLHttpRequest();
			request.onreadystatechange = function() {//Call a function when the state changes.
				if(request.readyState === 4 && request.status === 200) {
					var returnedData = request.responseText;
					//log(returnedData);

					var retValsTotal = {};
					var retValsCount = {};
					returnedData = JSON.parse(returnedData);
					console.log(returnedData);
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
					// all data has arrived so execute callback function on it.
					if (typeof callback !== 'undefined'){
						callback(retVals);
					}
				}
			};
			var async = true;
			var method = 'GET';
			request.open(method, url, async);
			request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
			request.send('');
		};
		httpRequest(url1);
		httpRequest(url2);
        }
        return retVals;
};


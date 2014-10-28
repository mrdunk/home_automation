function PageControl(){
    'use strict';
    console.log('PageControl');

    this.paper = new Raphael(document.getElementById('paper'), "100%", 400);
    this.dial = new TemperatureSensor('Temperature', this.paper, tempSensorList, 100, 200, 50, 7, 9, 10, 30, sendDataDelay, this.sendData);

    this.updateData();
    pageUpdateTimer = window.setInterval(function(){
        // TODO should this timer be part of dial.js?
        this.dial.updateGraph();
    }.bind(this), 50);
}

PageControl.prototype.drawPage = function (data) {
    'use strict';
    // Clear paper.
    //document.getElementById('paper').innerHTML = "";

};

PageControl.prototype.sendData = function(temperature, label){
    'use strict';
    console.log('PageControl.sendData');

    var dataList = [{'type':'userInput', 'data':{'label':'test_label', 'auth_key':'test_key', 'key':'set_' + label, 'val':temperature}}];

    var urlWs = {'host': serverFQDN,
                 'port': serverCubeMetricPort,
                 'path': '/cube-collect-ws/1.0/event/put'};
    var urlWget = {'host': serverFQDN,
                   'port': serverCubeMetricPort,
                   'path': '/1.0/event/put'};

    // TODO add repeat send for failures.
    nwConnection.sendData('PageControl.updateData.userInput', urlWs, urlWget, dataList);
};

/*PageControl.prototype.getDataQueryNWClients = function () {
    var dateStartRead = new Date();
    dateStartRead.setMinutes(dateStartRead.getMinutes() - timeWindow);
    dateStartRead = dateStartRead.toISOString();

    var dateStop = new Date();
    dateStop.setMinutes(dateStop.getMinutes() +60);
    dateStop = dateStop.toISOString();

    return [{'expression': 'sensors(key,val).eq(label,\'1wire\')',
                 'start': dateStartRead,
                 'stop': dateStop,
                 'limit': 2,
                 'sort': 'time'
                },
                {'expression': 'userInput(key,val).eq(key,\'set_Temperature\')',
                 'start': 0,
                 'stop': dateStop,
                 'limit': 1,
                 'sort': 'time'
                }];
};*/

PageControl.prototype.updateData = function () {
    'use strict';

    var urlWs,
        urlWget,
        urlQueryList;

    // Get temperature sensor data.
    urlWs = {'host': serverFQDN,
             'port': serverCubeMetricPort,
             'path': '/cube-metric-ws/1.0/event/get'};
    urlWget = {'host': serverFQDN,
               'port': serverCubeMetricPort,
               //'path': '/cube-metric/1.0/event/get'};
               'path': '/data'};

    //nwConnection.getData('PageControl.updateData.clients', urlWs, urlWget, this.getDataQueryNWClients, 1000, parseDataCube, this.dial.updateData.bind(this.dial));
    nwConnection.getData('PageControl.updateData.clients', urlWs, urlWget, [{'type': 'sensors', 'data': '{"label": "1wire"}'},{'type': 'userInput'}],
                         1000, parseDataCube, this.dial.updateData.bind(this.dial));
};


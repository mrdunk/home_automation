function PageControl(){
    'use strict';
    console.log('PageControl');

    document.getElementById('paper').innerHTML = "";
    this.paper = new Raphael(document.getElementById('paper'), "100%", 400);
    this.dial = new TemperatureSensor('Temperature', this.paper, tempSensorList, 75, 200, 50, 7, 9, 0, 40, sendDataDelay, this.sendData);

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

    // By setting the id to be the time in 10 minute multiples, we ensure there is only ever one value in the db for each 10 minute interval.
    var id = new Date().getTime()/(1000*600);
    id = Math.round(id);
    var dataList = [{'type':'userInput', 'id':id, 'data':{'label':'test_label', 'auth_key':'test_key', 'key':'set_' + label, 'val':temperature}}];

    var urlWs = {'host': serverFQDN,
                 'port': serverCubeMetricPort,
                 'path': '/cube-collect-ws/1.0/event/put'};
    var urlWget = {'host': serverFQDN,
                   'port': serverCubeMetricPort,
                   'path': '/cube-collect/1.0/event/put'};

    // TODO add repeat send for failures.
    nwConnection.sendData('PageControl.updateData.userInput', urlWs, urlWget, dataList);
};

PageControl.prototype.getDataQueryNWClients = function () {
    var dateStartRead = new Date();
    dateStartRead.setMinutes(dateStartRead.getMinutes() - timeWindow);
    dateStartRead = dateStartRead.toISOString();

    var dateStartSet = new Date();
    dateStartSet.setHours(dateStartSet.getHours() - 24);
    dateStartSet = dateStartSet.toISOString();

    var dataStop = new Date();
    dataStop.setMinutes(dataStop.getMinutes() +60);
    dataStop = dataStop.toISOString();

    return [{'expression': 'sensors(key,val).eq(label,\'1wire\')',
                 'start': dateStartRead,
                 'stop': dataStop,
                 'limit': 2,
                 'sort': 'time'
                },
                {'expression': 'userInput(key,val).eq(key,\'set_Temperature\')',
                 'start': dateStartSet,
                 'stop': dataStop,
                 'limit': 1,
                 'sort': 'time'
                }];
};

PageControl.prototype.updateData = function () {
    'use strict';

    var urlWs,
        urlWget,
        urlQueryList;

    urlWs = false;
    urlWget = {'host': 'home-automation-7.appspot.com',
               'port': '80',
               'path': '/listUsers/'};
//    nwConnection.getData('PageControl.updateData.users', urlWs, urlWget, [{'unused': '0'}], 1000, parseDataAppEngine, function(){});

    // Get MAC Address and IP Address mappings from server.
    urlWs = {'host': serverFQDN,
             'port': serverCubeMetricPort,
             'path': '/cube-metric-ws/1.0/event/get'};
    urlWget = {'host': serverFQDN,
               'port': serverCubeMetricPort,
               'path': '/cube-metric/1.0/event/get'};

    nwConnection.getData('PageControl.updateData.clients', urlWs, urlWget, this.getDataQueryNWClients, 1000, parseDataCube, this.dial.updateData.bind(this.dial));
};


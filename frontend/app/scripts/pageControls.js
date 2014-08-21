function PageControl(){
    'use strict';
    console.log('PageControl');


}

PageControl.prototype.drawPage = function (data) {
    'use strict';
    // Clear paper.
    document.getElementById('paper').innerHTML = "";

};

PageControl.prototype.updateData = function (callbackFunction) {
    'use strict';

    var urlDomainWs,
        urlDomainWget,
        urlQueryList;

    // Get User info from AppEngine
    urlDomainWs = false;
    urlDomainWget = 'home-automation-7.appspot.com/listUsers/';
    urlQueryList = [{'unused': '0'}];
    nwConnection.getData('PageControl.users', urlDomainWs, urlDomainWget, urlQueryList, 1000, parseDataAppEngine, callbackFunction);

    // Get time window to urlQueryList.
    var dateStartRead = new Date();
    dateStartRead.setMinutes(dateStartRead.getMinutes() - timeWindow);
    dateStartRead = dateStartRead.toISOString();

    var dateStartSet = new Date();
    dateStartSet.setHours(dateStartSet.getHours() - 24);
    dateStartSet = dateStartSet.toISOString();

    var dataStop = new Date();
    dataStop.setMinutes(dataStop.getMinutes() +60);
    dataStop = dataStop.toISOString();

    // Get MAC Address and IP Address mappings from server.
    urlDomainWs = serverFQDN + ':' + serverCubeMetricPort + '/cube-metric-ws/1.0/event/get';
    urlDomainWget = serverFQDN + ':' + serverCubeMetricPort + '/cube-metric/1.0/event/get';
    urlQueryList = [{'expression': 'sensors(key,val).eq(label,\'1wire\')',
                 'start': dateStartRead,
                 'stop': dataStop
                },
                {'expression': 'userInput(key,val).eq(key,\'set_Temperature\')',
                 'start': dateStartSet,
                 'stop': dataStop,
                 'limit': 1
                }];

    nwConnection.getData('PageControl.clients', urlDomainWs, urlDomainWget, urlQueryList, 1000, parseDataCube, callbackFunction);
};


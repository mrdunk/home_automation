function PageGraphs(){
    'use strict';
    console.log('Graphs');

    nwConnection = new Connection(true);

    var urlDomainWs,
        urlDomainWget,
        urlQueryList;

    // Get User info from AppEngine
    urlDomainWs = false;
    urlDomainWget = 'home-automation-7.appspot.com/listUsers/';
    urlQueryList = [{'unused': '0'}];
    nwConnection.getData('PageGraphs.users', urlDomainWs, urlDomainWget, urlQueryList, 1000, parseDataAppEngine, this.consumeData);

    // Get MAC Address and IP Address mappings from server.
    var dateStartRead = new Date();
    dateStartRead.setMinutes(dateStartRead.getMinutes() - 60*timeWindow);
    dateStartRead = dateStartRead.toISOString();

    var dataStop = new Date();
    dataStop.setMinutes(dataStop.getMinutes() +60);
    dataStop = dataStop.toISOString();

    urlDomainWs = serverFQDN + ':' + serverCubeMetricPort + '/cube-metric-ws/1.0/event/get';
    urlDomainWget = serverFQDN + ':' + serverCubeMetricPort + '/cube-metric/1.0/event/get';
    urlQueryList = [{'expression': 'sensors(label,key,val).eq(label,\'net_clients\')',
              'start': dateStartRead,
              'stop': dataStop }];
    console.log(JSON.stringify(urlQueryList[0]));

    nwConnection.getData('PageGraphs.clients', urlDomainWs, urlDomainWget, urlQueryList, 1000, parseDataCube, this.consumeData);
}

PageGraphs.prototype.consumeData = function(data){
    console.log(data);
};

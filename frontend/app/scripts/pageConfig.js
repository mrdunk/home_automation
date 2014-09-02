function PageConfig(){
    'use strict';
    console.log('pageConfig');

    this.deviceList = {};
    this.userList = {};
    this.editDeviceTemplate = loadTemplate('editDeviceTemplate.html');
    this.showDevicesTemplate = loadTemplate('showDevicesTemplate.html');
    this.updateTimers = [];

    this.updateData(this.drawPage.bind(this));
}

PageConfig.prototype.drawPage = function(data){
    'use strict';
    console.log('drawPage', data);
    if(typeof data === 'boolean'){
        // We don't care about the bool indicators of network sucess here.
        return;
    }

    var key;
    var queryList = [];
    var macAddr;
    var newData = false;

    var dateStart = 0;
    var dateStop = new Date();
    dateStop.setMinutes(dateStop.getMinutes() +60);     // End time set for 1 hour in the future.
    dateStop = dateStop.toISOString();


    for(key in data){
        console.log("  ", key);

        if(key === 'net_clients'){
            nwConnection.clearRepeatTimers('PageConfig.clients');
            for(macAddr in data.net_clients){
                if(!(macAddr in this.deviceList)){
                    this.deviceList[macAddr] = {ip: data.net_clients[macAddr].slice(-1),
                        description: '',
                        userId: '',
                        userName: '',
                        userUrl: ''};
                } else {
                    this.deviceList[macAddr].ip = data.net_clients[macAddr].slice(-1);
                }
                queryList.push({'expression': 'configuration(label,key,val).eq(key,\'' + macAddr + '\')',
                                  'start': dateStart,
                                  'stop': dateStop,
                                  'limit': 2,
                                  'sort': 'time' });
                console.log(queryList);
                newData = true;
            }
        } else if(key === 'users'){
            nwConnection.clearRepeatTimers('PageConfig.users');
            this.userList = data.users;
            console.log('users', data.users);
            newData = true;            
        } else if(key === 'userId'){
            nwConnection.clearRepeatTimers('PageConfig.drawPage.configuration');
            console.log('**', key);
            for(macAddr in data[key]){
                if(!(macAddr in this.deviceList)){
                    this.deviceList[macAddr] = {ip: '',
                        description: '',
                        userId: data[key][macAddr][0],
                        userName: '',
                        userUrl: ''};
                } else {
                    this.deviceList[macAddr].userId = data[key][macAddr][0];
                }
            }
            newData = true;
        } else if(key === 'description'){
            nwConnection.clearRepeatTimers('PageConfig.drawPage.configuration');
            for(macAddr in data[key]){
                if(!(macAddr in this.deviceList)){
                    this.deviceList[macAddr] = {ip: '',
                        description: data[key][macAddr][0],
                        userId: '',
                        userName: '',
                        userUrl: ''};
                } else {
                    this.deviceList[macAddr].description = data[key][macAddr];
                }
            }
            newData = true;
        }
    }

    // Combine this.deviceList and this.userList.
    for(macAddr in this.deviceList){
        var userId = this.deviceList[macAddr].userId;
        if(userId !== ''){
            if(this.deviceList[macAddr].userId in this.userList){
                this.deviceList[macAddr].userName = this.userList[userId].displayName;
                this.deviceList[macAddr].userUrl = this.userList[userId].image;
            }
        }
    }

    if(queryList.length !== 0){
        console.log('** More lookup', queryList);
        var urlWs = {'host': serverFQDN,
                 'port': serverCubeMetricPort,
                 'path': '/cube-metric-ws/1.0/event/get'};
        var urlWget = {'host': serverFQDN,
                   'port': serverCubeMetricPort,
                   'path': '/cube-metric/1.0/event/get'};
        this.updateTimers.push(
                nwConnection.getData('PageConfig.drawPage.configuration', urlWs, urlWget, queryList, 1000, parseDataCube, this.drawPage.bind(this)));
    }

    if(newData){
        // Clear paper.
        document.getElementById('paper').innerHTML = "";

        //console.log('this.deviceList:', this.deviceList);
        var paperDiv = document.getElementById('paper');

        var template = Handlebars.compile(this.showDevicesTemplate);
        var keyDiv = document.createElement('div');
        paperDiv.appendChild(keyDiv);
        keyDiv.innerHTML = template({deviceList: this.deviceList});

        for(key in this.deviceList){
            document.getElementById(key).onclick = this.editDevice.bind(this);
        }
        //console.log(this.deviceList);
    }

};

/* Dislay form to edit a network client's properties. */
PageConfig.prototype.editDevice = function (buttonPress){
    'use strict';
    console.log(this.deviceList);
    console.log(this.userList);
    var key = buttonPress.target.id;

    // Clear paper.
    var paperDiv = document.getElementById('paper');
    paperDiv.innerHTML = "";

    var keyDiv = document.getElementById('paper_' + key);
    keyDiv = document.createElement('div');
    keyDiv.id = 'paper_' + key;
    keyDiv.className = key;
    paperDiv.appendChild(keyDiv);

    var template = Handlebars.compile(this.editDeviceTemplate);
    var record = {key: key,
                  ip: this.deviceList[key].ip.slice(-1),
                  userId: this.deviceList[key].userId,
                  description: this.deviceList[key].description };

    var context = {record: record,
                   userList: this.userList};

    keyDiv.innerHTML = template(context);

    document.getElementById('selectName').onchange = this.updateDevice.bind(this);
    document.getElementById('description').onchange = this.updateDevice.bind(this);
    document.getElementById('saveDevice').onclick = this.saveDevice.bind(this);
};

/* Called when the "save" button is clicked during this.editDevice() */
PageConfig.prototype.saveDevice = function (userInput){
    console.log(userInput);
    console.log(userInput.id);

    var userId = document.getElementById('selectName').value;
    var description = document.getElementById('description').value;
    var macAddress = document.getElementById('macAddress').value;
    

    var dataList = [{'type':'configuration', 'data':{'label':'description', 'key':macAddress, 'val':description}},
                    {'type':'configuration', 'data':{'label':'userId', 'key':macAddress, 'val':userId}}];

    var urlWs = {'host': serverFQDN,
                 'port': serverCubeMetricPort,
                 'path': '/cube-collect-ws/1.0/event/put'};
    var urlWget = {'host': serverFQDN,
                   'port': serverCubeMetricPort,
                   'path': '/cube-collect/1.0/event/put'};

    // TODO add repeat send for failures.
    nwConnection.sendData('PageControl.updateData.userInput', urlWs, urlWget, dataList);

    this.drawPage({});
};

/* Called when any data is updated during this.editDevice() */
PageConfig.prototype.updateDevice = function (userInput){
        console.log(userInput);

        var selectName = document.getElementById('selectName').value;
        var description = document.getElementById('description').value;
        var macAddress = document.getElementById('macAddress').value;

        console.log(this.deviceList[macAddress]);
        console.log(selectName, description, macAddress);
        this.deviceList[macAddress].userId = selectName;
        this.deviceList[macAddress].description = description;
        if(selectName in this.userList){
            this.deviceList[macAddress].userName = this.userList[selectName].displayName;
        } else {
            this.deviceList[macAddress].userName = '';
        }

};

PageConfig.prototype.updateData = function (callbackFunction) {
    'use strict';
    console.log('PageConfig.updateData');

    var urlWs,
        urlWget,
        urlQueryList;

    // Get User info from AppEngine
    urlWs = false;
    urlWget = {'host': 'home-automation-7.appspot.com',
               'port': '80',
               'path': '/listUsers/'};
    urlQueryList = [{'unused': '0'}];
    this.updateTimers.push(
            nwConnection.getData('PageConfig.users', urlWs, urlWget, urlQueryList, 1000, parseDataAppEngine, callbackFunction));

    // Get all MAC Address and IP Address mappings in the last hour from server.
    var dateStartRead = new Date();
    dateStartRead.setMinutes(dateStartRead.getMinutes() - 60*timeWindow);
    dateStartRead = dateStartRead.toISOString();

    var dateStop = new Date();
    dateStop.setMinutes(dateStop.getMinutes() +60);
    dateStop = dateStop.toISOString();

    urlWs = {'host': serverFQDN,
             'port': serverCubeMetricPort,
             'path': '/cube-metric-ws/1.0/event/get'};
    urlWget = {'host': serverFQDN,
               'port': serverCubeMetricPort,
               'path': '/cube-metric/1.0/event/get'};
    var urlQueryListCallback = function(){
        var dateStartRead = new Date();
        dateStartRead.setMinutes(dateStartRead.getMinutes() - 60*timeWindow);
        dateStartRead = dateStartRead.toISOString();

        var dateStop = new Date();
        dateStop.setMinutes(dateStop.getMinutes() +60);
        dateStop = dateStop.toISOString();

        return [{'expression': 'sensors(label,key,val).eq(label,\'net_clients\')',
                'start': dateStartRead,
                'stop': dateStop }];
    };

    this.updateTimers.push(
        nwConnection.getData('PageConfig.clients', urlWs, urlWget, urlQueryListCallback, 1000, parseDataCube, callbackFunction));
};

var loadTemplate = function(filename){
        'use strict';
        // This function blocks untill template is loaded.
        console.log('loadTemplate:', filename);
        var ajax = new XMLHttpRequest();
        ajax.open("GET", filename, false);
        ajax.send();
        return ajax.responseText;
};

Handlebars.registerHelper('selected', function(left, right) {
    if(left.localeCompare(right) === 0){
        return 'selected';
    }
    return '';
});

function PageConfig(){
    'use strict';
    console.log('pageConfig');

    this.deviceList = {};
    this.userList = {};
    this.editDeviceTemplate = loadTemplate('editDeviceTemplate.html');
    this.showDevicesTemplate = loadTemplate('showDevicesTemplate.html');
    this.updateTimers = [];

//    this.updateData(this.drawPage.bind(this));
    this.drawPage();
}

PageConfig.prototype.drawPage = function(){
    'use strict';
    console.log('drawPage2', usersAtHome.userData);

    // TODO display message and reload if user data not in buffer yet.

    // Clear paper.
    var paperDiv = document.getElementById('paper');
    paperDiv.innerHTML = "";

    var template = Handlebars.compile(this.showDevicesTemplate);
    var keyDiv = document.createElement('div');
    paperDiv.appendChild(keyDiv);
    keyDiv.innerHTML = template({deviceList: usersAtHome.userData.deviceList});

    for(var key in usersAtHome.userData.deviceList){
        document.getElementById(key).onclick = this.editDevice.bind(this);
    }
};

/* Dislay form to edit a network client's properties. */
PageConfig.prototype.editDevice = function (buttonPress){
    'use strict';
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
                  ip: usersAtHome.userData.deviceList[key].ip.slice(-1),
                  userId: usersAtHome.userData.deviceList[key].userId,
                  description: usersAtHome.userData.deviceList[key].description };

    var context = {record: record,
                   userList: usersAtHome.userData.userList};

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

    usersAtHome.lookup();

    this.drawPage();
};

/* Called when any data is updated during this.editDevice() */
PageConfig.prototype.updateDevice = function (userInput){
        console.log(userInput);

        var selectName = document.getElementById('selectName').value;
        var description = document.getElementById('description').value;
        var macAddress = document.getElementById('macAddress').value;

        console.log(this.deviceList[macAddress]);
        console.log(selectName, description, macAddress);
        usersAtHome.userData.deviceList[macAddress].userId = selectName;
        usersAtHome.userData.deviceList[macAddress].description = description;
        if(selectName in usersAtHome.userData.userList){
            usersAtHome.userData.deviceList[macAddress].userName = usersAtHome.userData.userList[selectName].displayName;
        } else {
            usersAtHome.userData.deviceList[macAddress].userName = '';
        }

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

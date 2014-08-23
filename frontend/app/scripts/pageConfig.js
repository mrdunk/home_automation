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

    // Clear paper.
    document.getElementById('paper').innerHTML = "";

	var key;
	var firstLoop = true;
        for(key in data){
		if(firstLoop === true){
			// Only clearing timer if data received.
			nwConnection.clearRepeatTimers();
			firstLoop = false;
		}

		if(key === 'net_clients'){
			for(var macAddr in data.net_clients){
                nwConnection.clearRepeatTimers('PageConfig.clients');
				if(!(macAddr in this.deviceList)){
					this.deviceList[macAddr] = {ip: data.net_clients[macAddr].slice(-1),
							       description: '',
							       userId: '',
							       userName: '',
							       userUrl: ''};
				}
			}
		} else if(key === 'users'){
            nwConnection.clearRepeatTimers('PageConfig.users');
			this.userList = data.users;
		}
	}


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
	var context = {key: key,
		       ip: this.deviceList[key].ip.slice(-1),
		       description: this.deviceList[key].description,
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

	var macAddress = document.getElementById('macAddress').value;

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
	}

};

PageConfig.prototype.updateData = function (callbackFunction) {
    'use strict';

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

    // Get MAC Address and IP Address mappings from server.
    var dateStartRead = new Date();
    dateStartRead.setMinutes(dateStartRead.getMinutes() - 60*timeWindow);
    dateStartRead = dateStartRead.toISOString();

    var dataStop = new Date();
    dataStop.setMinutes(dataStop.getMinutes() +60);
    dataStop = dataStop.toISOString();

    urlWs = {'host': serverFQDN,
             'port': serverCubeMetricPort,
             'path': '/cube-metric-ws/1.0/event/get'};
    urlWget = {'host': serverFQDN,
               'port': serverCubeMetricPort,
               'path': '/cube-metric/1.0/event/get'};
    urlQueryList = [{'expression': 'sensors(label,key,val).eq(label,\'net_clients\')',
              'start': dateStartRead,
              'stop': dataStop }];

    this.updateTimers.push(
        nwConnection.getData('PageConfig.clients', urlWs, urlWget, urlQueryList, 1000, parseDataCube, callbackFunction));
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

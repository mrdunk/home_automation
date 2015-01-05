// Functions for the "configure" page.

document.onmousedown = mouseDown;
document.onmouseup   = mouseUp;
var mouseState = "up";

function mouseDown(ev) {
    mouseState = "down";
    console.log('Down State you can now start dragging');
    //do not write any code here in this function
}

function mouseUp(ev) {
    mouseState = "up";
    console.log('up state you cannot drag now because you are not holding your mouse')
    //do not write any code here in this function
}


Handlebars.registerHelper('safeVal', function (value, safeValue) {
    'use strict';
    var out = value || safeValue;
    return new Handlebars.SafeString(out);
});         

Handlebars.registerHelper('ifSelected', function(v1, v2){
    'use strict';
    if(v1 === v2){
        return 'selected'; 
    }
    return '';
});

Handlebars.registerHelper('dayStart', function(time, options){
    'use strict';
    if (arguments.length < 2){
        throw new Error("Handlebars Helper equal needs 1 parameter");
    }

    if(time % 1440 !== 0){
        return options.inverse(this);
    } else {
        return options.fn(this);
    }
});

Handlebars.registerHelper('day', function(time){
    'use strict';
    if(time < 1440){
        return 'Sun';
    } else if(time < 2 * 1440){
        return 'Mon';
    } else if(time < 3 * 1440){
        return 'Tue';
    } else if(time < 4 * 1440){
        return 'Wed';
    } else if(time < 5 * 1440){
        return 'Thu';
    } else if(time < 6 * 1440){
        return 'Fri';
    }
    return 'Sat';
});

function DisplaySettings(){
    'use strict';
    this.populateForm = {};
    this.userDevices = {};
    this.thermometers = {};

    this.selectedTemperatureSetPoints = [];
}

DisplaySettings.prototype.onClick = function(devId, action){
    'use strict';
    console.log(devId, action);

    if(action === 'edit'){
        this.userDevices[devId].configStatus = 'edit';
    } else if(action === 'cancel'){
        this.userDevices[devId].description_modified[0] = this.userDevices[devId].description[0];
        this.userDevices[devId].userId_modified[0] = this.userDevices[devId].userId[0];
        document.getElementById(devId + "-description").value = this.userDevices[devId].description[0];
        document.getElementById(devId + "-userId").value = this.userDevices[devId].userId[0];
        this.userDevices[devId].configStatus = 'view';
    } else if(action === 'save'){
        var configData = [];
        if(this.userDevices[devId].userId_modified !== undefined &&
                this.userDevices[devId].userId_modified[0] !== this.userDevices[devId].userId[0]){
            configData.push({'type': 'configuration',
                           'data': {'key': devId,
                                    'label': 'userId',
                                    'val': this.userDevices[devId].userId_modified[0]}
                          });
        }
        if(this.userDevices[devId].description_modified !== undefined &&
                this.userDevices[devId].description_modified[0] !== this.userDevices[devId].description[0]){
            configData.push({'type': 'configuration',
                           'data': {'key': devId,
                                    'label': 'description',
                                    'val': this.userDevices[devId].description_modified[0]}
                          });
        }
        console.log(configData);
        dataStore.serverConnectionsToSend.send("send", JSON.stringify(configData), function(testvar){this.saved(testvar);}.bind(this), 6);
        this.userDevices[devId].configStatus = 'view';
    } else if(action === 'select'){
        var day = Math.floor(devId / (60*24));
        var time = devId % (60*24);
        console.log(devId, action, day, time);

        this.clearSelected();
        this.selectedTemperatureSetPoints = [devId];
    }


    var activeDevices = document.getElementById("activeDevices");
    this.updateView(activeDevices);
};

DisplaySettings.prototype.onMouseDown = function(index){
    var day = Math.floor(index / (60*24));
    var time = index % (60*24);
    console.log(index, day, time);
    this.dragStartDay = day;
    this.dragStartTime = time;
};

DisplaySettings.prototype.onMouseOver = function(index){
    if(mouseState === "down"){
        this.onMouseUp(index);
    }
}

DisplaySettings.prototype.onMouseUp = function(index){
    var day = Math.floor(index / (60*24));
    var time = index % (60*24);
    console.log(index, day, time);

    var dayL, dayH, timeL, timeH;
    if(day <= this.dragStartDay){
        dayL = day;
        dayH = this.dragStartDay;
    } else {
        dayL = this.dragStartDay;
        dayH = day;
    }
    if(time <= this.dragStartTime){
        timeL = time;
        timeH = this.dragStartTime;
    } else {
        timeL = this.dragStartTime;
        timeH = time;
    }

    this.clearSelected();

    console.log(dayL, dayH, timeL, timeH);

    for(var dayItt = dayL; dayItt <= dayH; ++dayItt){
        for(var timeItt = timeL; timeItt <= timeH; timeItt += 5){
            this.selectedTemperatureSetPoints.push(dayItt * 60 * 24 + timeItt);
        }
    }

    this.updateView();
    
};

DisplaySettings.prototype.saved = function(data){
    'use strict';
    console.log(data);
    if(data === "ok"){
        dataStore.serverConnectionsToPoll.doRequestsNow();
    }
};

DisplaySettings.prototype.clearSelected = function(){
    var selectedNode;
    for(var i in this.selectedTemperatureSetPoints){
        selectedNode = document.getElementById(this.selectedTemperatureSetPoints[i] + "-temperatureSetPoints");
        if(selectedNode){
            selectedNode.style.borderColor = "black";
        }
    }
    this.selectedTemperatureSetPoints = [];
};

DisplaySettings.prototype.onChange = function(devId, field){
    'use strict';
    console.log(devId, field);
    console.log(document.getElementById(devId + "-" + field).value);

    this.userDevices[devId][field + "_modified"] = [document.getElementById(devId + "-" + field).value, Date.now()];
};

DisplaySettings.prototype.updateView = function(parentNode){
    'use strict';
    if(parentNode){
        var divs = parentNode.getElementsByTagName('div');
        for(var d in divs){
            if(divs[d] !== undefined && divs[d].className !== undefined){
                var classes = divs[d].className.split(" ");
                for(var c in classes){
                    var devId = classes[c].split("-")[0];
                    var state = classes[c].split("-")[1];
                    if(devId !== undefined && state !== undefined && (state === "edit" || state === "view")){
                        if(devId in this.userDevices){
                            if(this.userDevices[devId].configStatus === state){
                                divs[d].style.display = "inline";
                            } else {
                                divs[d].style.display = "none";
                            }
                        }
                    }
                }
            }
        }
    }

    var selectedNode;
    for(var i in this.selectedTemperatureSetPoints){
        selectedNode = document.getElementById(this.selectedTemperatureSetPoints[i] + "-temperatureSetPoints");
        if(selectedNode){
            selectedNode.style.borderColor = "red";
        }
    }
};

DisplaySettings.prototype.deleteFromView = function(devIds, parentNode){
    'use strict';
    var divs = parentNode.getElementsByTagName('div');
    for(var devId in devIds){
        var d = divs.length;
        while(d--){     // To avoid the "resizing the list of divs while itterating through it" problem.
            if(divs[d] !== undefined && divs[d].className !== undefined){
                var classes = divs[d].className.split(" ");
                for(var c in classes){
                    if(classes[c].substring(0, devId.length) === devId){
                        var state = classes[c].split("-")[1];
                        if(classes[c] === devId + "-view" || classes[c] === devId + "-edit" || classes[c] === devId + "-all"){
                            parentNode.removeChild(divs[d]);
                        }
                    }
                }
            }
        }
    }
};

DisplaySettings.prototype.update = function(){
    'use strict';
    var main = document.getElementsByTagName("main")[0];

    var activeDevices = document.getElementById("activeDevices");
    if(activeDevices === null){
        activeDevices = document.createElement('div');
        activeDevices.id = "activeDevices";
        main.appendChild(activeDevices);
    }
    var temperatureSetPoints = document.getElementById("temperatureSetPoints");
    if(temperatureSetPoints === null){
        temperatureSetPoints = document.createElement('div');
        temperatureSetPoints.id = "temperatureSetPoints";
        temperatureSetPoints.style["vertical-align"] = "bottom";
        main.appendChild(temperatureSetPoints);
    }

    // Create list of devices not yet displayed on page.
    var userDevicesNew = {};
    for(var device in dataStore.allDataContainer){
        if(dataStore.allDataContainer[device]['1wire'] === undefined && dataStore.allDataContainer[device].description !== undefined){
            // This dataStore.allDataContainer[device] is a Network device.

            if(this.userDevices[device] === undefined){
                // New device.
                this.userDevices[device] = {"configStatus": "view"};
            }
            if(document.getElementById(device + "-device") === null){
                // Device not displayed on screen but data is populated.
                userDevicesNew[device] = this.userDevices[device];
            }
            if(this.userDevices[device].configStatus !== 'edit'){
                // Don't do anything if we are currently editing this device.
                for(var item in dataStore.allDataContainer[device]){
                    // Compare fields between incoming data and that currently displayed.
                    if(this.userDevices[device][item] === undefined ||
                            dataStore.allDataContainer[device][item][0] !== this.userDevices[device][item][0]){
                                this.userDevices[device][item] = dataStore.allDataContainer[device][item];
                                if(userDevicesNew[device] === undefined){
                                    userDevicesNew[device] = this.userDevices[device];
                                }
                            }
                }
            }
            if(this.userDevices[device].description_modified === undefined){
                this.userDevices[device].description_modified = [this.userDevices[device].description[0], this.userDevices[device].description[1]];
            }
            if(this.userDevices[device].userId_modified === undefined){
                this.userDevices[device].userId_modified = [this.userDevices[device].userId[0], this.userDevices[device].userId[1]];
            }

        } else {
            this.thermometers[device] = dataStore.allDataContainer[device];
        }
    }

    var populateForm = {};
    populateForm.userDevices = userDevicesNew;
    populateForm.users = dataStore.userDataContainer;

    this.deleteFromView(userDevicesNew, activeDevices);

    // Append new divs to main without intefering with existing ones.
    var newcontent = document.createElement('div');
    newcontent.innerHTML = displayConfigureTemplate(populateForm);
    while (newcontent.firstChild) {
        activeDevices.appendChild(newcontent.firstChild);
    }


    // Get data from server.
    if(dataStore.allDataContainer.temp_setting_1_week === undefined ||
            Date.now() - dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[1] > 10000){
        dataStore.sendQueryNow("house", "/tempSettings?", function(data){console.log("####", data);});
    }

    var time;
    if(dataStore.allDataContainer.temp_setting_1_week !== undefined){
        populateForm = {};
        populateForm.temperatureSetKey = {};
        populateForm.temperatureSetPoints = {};

        // Populate key data.
        dataStore.allDataContainer.temp_setting_1_week.temperatureSetKey = {};
        for(time=0; time < 60*24; time += 60){
            populateForm.temperatureSetKey[time] = Math.round(time / 60);
        }

        for(time=0; time < 60*24*7; time += 15){
            populateForm.temperatureSetPoints[time] = [dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][time] -10, 
                Math.round(10 * dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][time]) / 10];
        }
        temperatureSetPoints.innerHTML = temperatureSetPointsTemplate(populateForm);
    }

    
    this.updateView(activeDevices);
};

/* Wrapper arround an instance of the DisplaySettings calss so we can use it as a callback easily. */
var displaySettingsInstance = new DisplaySettings();
var DisplaySettingsUpdate = function(){
    'use strict';
    displaySettingsInstance.update();
};

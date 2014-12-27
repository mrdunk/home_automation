// Functions for the "configure" page.

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


function DisplaySettings(){
    'use strict';
    this.populateForm = {};
    this.userDevices = {};
    this.thermometers = {};
}

DisplaySettings.prototype.onClick = function(devId, action){
    'use strict';
    console.log(devId);

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
        dataStore.serverConnectionsToSend.send("send", JSON.stringify(configData), function(testvar){console.log(testvar);}, 6);
        this.userDevices[devId].configStatus = 'view';
    }

    this.updateView();
};

DisplaySettings.prototype.onChange = function(devId, field){
    'use strict';
    console.log(devId, field);
    console.log(document.getElementById(devId + "-" + field).value);

    this.userDevices[devId][field + "_modified"] = [document.getElementById(devId + "-" + field).value, Date.now()];
};

DisplaySettings.prototype.updateView = function(){
    'use strict';
    var main = document.getElementsByTagName("main")[0];
    var divs = main.getElementsByTagName('div');
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
};

DisplaySettings.prototype.deleteFromView = function(devIds){
    'use strict';
    var main = document.getElementsByTagName("main")[0];
    var divs = main.getElementsByTagName('div');
    for(var devId in devIds){
        var d = divs.length;
        while(d--){     // To avoid the "resizing the list of divs while itterating through it" problem.
            if(divs[d] !== undefined && divs[d].className !== undefined){
                var classes = divs[d].className.split(" ");
                for(var c in classes){
                    if(classes[c].substring(0, devId.length) === devId){
                        var state = classes[c].split("-")[1];
                        if(classes[c] === devId + "-view" || classes[c] === devId + "-edit" || classes[c] === devId + "-all"){
                            main.removeChild(divs[d]);
                        }
                    }
                }
            }
        }
    }
};

DisplaySettings.prototype.update = function(){
    'use strict';

    console.log(this.userDevices);

        var main = document.getElementsByTagName("main")[0];

        var userDevicesNew = {};

        for(var device in dataStore.allDataContainer){
            if(dataStore.allDataContainer[device]['1wire'] === undefined){
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

        console.log(userDevicesNew);

        this.deleteFromView(userDevicesNew);

        var newcontent = document.createElement('div');
        newcontent.innerHTML = displayConfigureTemplate(populateForm);
        while (newcontent.firstChild) {
            main.appendChild(newcontent.firstChild);
        }
        //main.innerHTML = displayConfigureTemplate(populateForm);

        this.updateView();

        console.log(this.userDevices);
};

/* Wrapper arround an instance of the DisplaySettings calss so we can use it as a callback easily. */
var displaySettingsInstance = new DisplaySettings();
var DisplaySettingsUpdate = function(){
    'use strict';
    displaySettingsInstance.update();
};

/* global dataStore */
/* global xtag */
/* global displayConfigureTemplate */

    (function(xtag) {
        'use strict';
        xtag.register('x-registerDevices', {
            lifecycle: {
                created: function() {
                    console.log('x-registerDevices');
                    this.className = 'registerDevices';

                    this.userDevices = {};
                    this.updateView();
                }
            },
            events: {
                tap: function tap(devId){
                    if(this.tapStart){
                        return;
                    }
                    // this.tapStart ensures we don't get multiple clicks froma single press
                    // when the button underneath where getting clicked changes.
                    // This was a problem when clicking the "Edit" button also clicked the "Save"
                    // button which appeared in place of "Edit".
                    this.tapStart = true;
                    window.setTimeout(function clearTapStart(){this.tapStart = false;}.bind(this), 1000);

                    var devIdId;
                    if(devId.srcElement){
                       devIdId = devId.srcElement.id;
                    } else {
                        devIdId = devId.target.id;
                    }

                    if(devIdId.split("-").length !== 2){
                        return;
                    }

                    devId = devIdId.split("-")[0];
                    var action = devIdId.split("-")[1];
                    //console.log('tap', devIdId, devId, action);

                    if(action === 'editButton'){
                        this.userDevices[devId].configStatus = 'edit';
                    } else if(action === 'cancelButton'){

                        // Use .slice() for deep copy.
                        this.userDevices[devId].description_modified =
                                this.userDevices[devId].description.slice();
                        this.userDevices[devId].userId_modified =
                                this.userDevices[devId].userId.slice();

                        document.getElementById(devId + "-description").value = 
                                this.userDevices[devId].description[0];
                        document.getElementById(devId + "-userId").value = 
                                this.userDevices[devId].userId[0];
                        this.userDevices[devId].configStatus = 'view';
                    }  else if(action === 'saveButton'){
                        // Read new data straight from form.
                        this.userDevices[devId].userId_modified = 
                                [document.getElementById(devId + "-userId").value, Date.now()];
                        this.userDevices[devId].description_modified = 
                                [document.getElementById(devId + "-description").value, Date.now()];

                        // Now compile update message and send to server.
                        var configData = [];
                        if(this.userDevices[devId].userId_modified[0] !== 
                                        this.userDevices[devId].userId[0]){
                            configData.push({'type': 'configuration',
                                    'data': {'key': devId,
                                    'label': 'userId',
                                    'val': this.userDevices[devId].userId_modified[0]}
                                    });
                        }
                        if(this.userDevices[devId].description_modified[0] !== 
                                        this.userDevices[devId].description[0]){
                            configData.push({'type': 'configuration',
                                    'data': {'key': devId,
                                    'label': 'description',
                                    'val': this.userDevices[devId].description_modified[0]}
                                    });
                        }
                        dataStore.network.put(JSON.stringify(configData), 
                                function registerDevicesSaveCallback(data){
                                    console.log('callback: ' , data);
                                    if(data === "ok"){
                                        this.updateData();
                                    }
                                }.bind(this));

                        // Use .slice() for deep copy.
                        this.userDevices[devId].description_modified =
                            this.userDevices[devId].description.slice();
                        this.userDevices[devId].userId_modified =
                            this.userDevices[devId].userId.slice();

                        this.userDevices[devId].configStatus = 'view';
                    }

                    this.updateView();
                },
            },
            accessors: {
                updated: {
                    // For some reason, setting .updated results in a 
                    // "Uncaught TypeError: Cannot assign to read only property 'updated'" error
                    // We can achieve the same thing by just reading this value.
                    get: function updateViewGet(){
                        console.log('get');
                        this.updateView();
                    },
                    set: function updateViewSet(value){
                        this.setAttribute('updated', value);
                        this.updateView();
                    }
                }
            },
            methods: {
                updateData: function updateData(){
                    dataStore.network.get('/data?type=configuration&data={"label":"description"}');
                    dataStore.network.get('/data?type=configuration&data={"label":"userId"}');
                },
                updateView: function updateView(){
                    //console.log('updateView');
                    // Create list of devices not yet displayed on page.
                    var userDevicesNew = {};
                    for(var device in dataStore.allDataContainer){
                        if(dataStore.allDataContainer[device].type === 'net_client'){
                            // This dataStore.allDataContainer[device] is a Network device.
                            if(!this.userDevices[device]){
                                // New device.
                                this.userDevices[device] = {"configStatus": "view"};
                            }
                            if(this.userDevices[device].configStatus !== 'edit'){
                                // As long as we are not currently editing it...
                                for(var i in ['description', 'net_clients', 'userId', 'displayName']){
                                    var item = ['description', 'net_clients', 'userId', 'displayName'][i];
                                    if(!dataStore.allDataContainer[device][item]){
                                        this.userDevices[device][item] = '';
                                        if(!userDevicesNew[device]){
                                            userDevicesNew[device] = this.userDevices[device];
                                        }
                                    } else if(!this.userDevices[device][item] ||
                                            dataStore.allDataContainer[device][item][0] !== this.userDevices[device][item][0]){
                                        this.userDevices[device][item] = dataStore.allDataContainer[device][item];
                                        if(!userDevicesNew[device]){
                                            userDevicesNew[device] = this.userDevices[device];
                                        }
                                    }
                                }
                            }
                            if(document.getElementById(device + "-device") === null && 
                                    this.userDevices[device].configStatus !== 'edit'){
                                // Device not displayed on screen but data is populated.
                                userDevicesNew[device] = this.userDevices[device];
                            }
                            if(this.userDevices[device].configStatus !== 'edit'){
                                if(this.userDevices[device].description){
                                    // Use .slice() for deep copy.
                                    this.userDevices[device].description_modified =
                                            this.userDevices[device].description.slice();
                                }
                                if(this.userDevices[device].userId){
                                    this.userDevices[device].userId_modified =
                                            this.userDevices[device].userId.slice();
                                }
                            }
                        }
                    }

                    var users = {};
                    for(var entry in dataStore.allDataContainer){
                        if(dataStore.allDataContainer[entry].type === 'user'){
                            users[entry] = dataStore.allDataContainer[entry];
                        }
                    }


                    var populateForm = {};
                    populateForm.userDevices = userDevicesNew;
                    populateForm.users = users;
                    
                    // Get rid of any stale entries from the display.
                    this.deleteFromView(userDevicesNew);

                    // Append new divs to main without intefering with existing ones.
                    var newcontent = document.createElement('div');
                    newcontent.innerHTML = displayConfigureTemplate(populateForm);
                    while (newcontent.firstChild) {
                        this.appendChild(newcontent.firstChild);
                    }

                    // Now make sure the correct things are visible.
                    var divs = this.getElementsByTagName('div');
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

                },
                deleteFromView: function deleteFromView(userDevicesNew){
                    // Remove any divs that are in the provided list.
                    var divs = this.getElementsByTagName('div');
                    for(var devId in userDevicesNew){
                        var d = divs.length;
                        while(d--){     // To avoid the "resizing the list of divs while itterating through it" problem.
                            if(divs[d] !== undefined && divs[d].className !== undefined){
                                var classes = divs[d].className.split(" ");
                                for(var c in classes){
                                    if(classes[c].substring(0, devId.length) === devId){
                                        //var state = classes[c].split("-")[1];
                                        if(classes[c] === devId + "-view" || 
                                                classes[c] === devId + "-edit" || 
                                                classes[c] === devId + "-all"){
                                            this.removeChild(divs[d]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    })(xtag);

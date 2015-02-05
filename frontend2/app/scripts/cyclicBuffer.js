/* global dataStore */
/* global xtag */
/* global bufferSetPointsControlsTemplate */
/* global bufferSetPointsTemplate */
/* global mouseState */

    (function(xtag) {
        'use strict';
        xtag.register('x-cyclicBuffer', {
            lifecycle: {
                created: function() {
                    this.className = 'cyclicBuffer';
                    this.touchState = 'up';

                    if(this.label){
                        this.updateData();
                    } else {
                        console.log("label property not set for x-cyclicBuffer yet.");
                        // Note that we will load data using updateData() when this.label is set.
                    }
                }
            },
            events: {
                touchend: function(devId){
                    this.touchState = 'up';

                    // Since this callback returns the element where the swipe first started,
                    // we bluff the ID we send and use the last one we received from the touchmove
                    // callback.
                    this.movmentWrapper(this.lastValidIndex + '-' + this.label + '-setPoints', false);
                },
                touchstart: function(devId){
                    console.log('touchstart', devId);
                    delete this.dragging;
                    this.touchState = 'down';
                },
                click: function(devId){
                    var element = devId.srcElement || devId.target;
                    var devIdId = element.id;
                    if(devIdId === ""){
                        devIdId = element.parentNode.id;
                    }

                    if(devIdId.split("-").length !== 3 ||
                            devIdId.split("-")[1] !== this.label ||
                            (devIdId.split("-")[2] !== 'modifyBufferButton' &&
                            devIdId.split("-")[2] !== 'setPoints')){
                        return;
                    }
                    var action = devIdId.split("-")[0];

                    if(action === 'smooth'){
                        this.smooth();
                    } else if(action === 'set'){
                        this.setValue();
                    } else if(action === 'cancel'){
                        this.cancel();
                    } else if(action === 'save'){
                        this.save();
                    } else if(devIdId.split("-")[2] === 'setPoints' && this.touchState === "up"){
                        this.movmentWrapper(devIdId, true);
                    }
                },
                onchange: function(devId){
                    //console.log('onchange', devId.srcElement.id);
                    var element = devId.srcElement || devId.target;
                    var action = element.id.split("-")[0];

                    if(action === 'set'){
                        this.setValue();
                    }
                },
                touchmove: function(devId){
                    // This callback returns the devId where the swipe first started so we need to use the 
                    // coordinates to find the element.
                    var target = document.elementFromPoint(devId.touches[0].pageX, devId.touches[0].pageY);
                    var devIdId = target.id;
                    if(devIdId === ""){
                        var element = devId.srcElement || devId.target;
                        devIdId = element.parentNode.id;
                    }
                    if(devIdId === ""){
                        devIdId = target.parentNode.id;
                    }
                    this.movmentWrapper(target.id, this.touchState === "down");
                },
                move: function(devId){
                    //console.log('move', devId.srcElement.id);
                    if(this.touchState === "up"){
                        var element = devId.srcElement || devId.target;
                        var devIdId = element.id;
                        if(devIdId === ""){
                            devIdId = element.parentNode.id;
                        }
                        this.movmentWrapper(devIdId, mouseState === "down");
                    }
                },
            },
            accessors: {
                label: {
                    // The label property contains the name of the cyclicBuffer in the DB.
                    get: function(){
                        return this.getAttribute('label');
                    },
                    set: function(value){
                        console.log("accessors:label:set: ", value);
                        this.xtag.data.label = value;
                        this.setAttribute('label', value);
                        console.log(this.label);

                        // Get the data from server.
                        this.updateData();
                    }
                },
                stepsize: {
                    get: function(){
                        return this.getAttribute('stepsize');
                    },
                    set: function(value){
                        this.xtag.data.stepsize = value;
                        this.setAttribute('stepsize', value);
                        
                        // Get the data from server.
                        this.updateData();
                    }
                },
                displaymax: {
                    get: function(){
                        return this.getAttribute('displaymax');
                    },
                    set: function(value){
                        this.xtag.data.displaymax = value;
                        this.setAttribute('displaymax', value);
                        
                        // Get the data from server.
                        this.updateData();
                    }
                },
                displaymin: {
                    get: function(){
                        return this.getAttribute('displaymin');
                    },
                    set: function(value){
                        this.xtag.data.displaymin = value;
                        this.setAttribute('displaymin', value);
                        
                        // Get the data from server.
                        this.updateData();
                    }
                },
                displayscale: {
                    get: function(){
                        return this.getAttribute('displayscale');
                    },
                    set: function(value){
                        this.xtag.data.displayscale = value;
                        this.setAttribute('displayscale', value);
                        
                        // Get the data from server.
                        this.updateData();
                    }
                },
                displaystep: {
                    get: function(){
                        return this.getAttribute('displaystep');
                    },
                    set: function(value){
                        this.xtag.data.displaystep = value;
                        this.setAttribute('displaystep', value);
                        
                        // Get the data from server.
                        this.updateData();
                    }
                },
                updated: {
                    // For some reason, setting .updated results in a 
                    // "Uncaught TypeError: Cannot assign to read only property 'updated'" error
                    // We can achieve the same thing by just reading this value.
                    get: function(){
                        console.log('get');
                        this.draw();
                    },
                    set: function(value){
                        this.setAttribute('updated', value);
                        this.draw();
                    }
                }                
            },
            methods: {
                clearSelected: function(){
                    var selectedNode;
                    for(var i in this.selectedSetPoints){
                        selectedNode = document.getElementById(this.selectedSetPoints[i] + "-" + this.label + "-setPoints");
                        if(selectedNode){
                            selectedNode.style.borderColor = "black";
                        }
                    }
                    this.selectedSetPoints = [];
                },
                updateView: function(colour){
                    // highlight selectedSetPoints when selected.
                    var selectedNode;
                    for(var i in this.selectedSetPoints){
                        selectedNode = document.getElementById(this.selectedSetPoints[i] + "-" + this.label + "-setPoints");
                        if(selectedNode){
                            selectedNode.style.borderColor = colour;
                        }
                    }
                },
                displayDrag: function(index){
                    //console.log('displayDrag', index);
                    var day = Math.floor(index / (60*24));
                    var time = index % (60*24);

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

                    this.updateView('black');
                    this.selectedSetPoints = [];
                    for(var dayItt = dayL; dayItt <= dayH; ++dayItt){
                        for(var timeItt = timeL; timeItt <= timeH; timeItt += parseInt(this.stepsize)){
                            this.selectedSetPoints.push(dayItt * 60 * 24 + timeItt);
                        }
                    }

                    this.calculateAverageValue();
                    this.updateView('red');
                },
                updateData: function(skipUpdateTimeCheck){
                    if(this.label === 'undefined' || this.stepsize === 'undefined' || this.displaystep === 'undefined' ||
                            this.displaymax === 'undefined' || this.displaymin === 'undefined'){
                        // Missing necesary peramiters.
                        console.log("missing peramiters.", this.label, this.stepsize,
                                this.displaymax, this.displaymin);
                        return;
                    }

                    // Get data from server.
                    if(!skipUpdateTimeCheck && this.serverLastQueriedAt === undefined || Date.now() - this.serverLastQueriedAt > 600000){
                        this.serverLastQueriedAt = Date.now();
                        dataStore.network.get('/cyclicDB_' + this.label + '?');
                    }
                },
                draw: function() {
                    //console.log("draw", this.label);

                    var child;
                    var bufferSetPoints = null;
                    var bufferSetPointsControls = null;
                    for(child in this.children){
                        if(this.children[child].id === this.label + "-bufferSetPoints"){
                            bufferSetPoints = this.children[child];
                        }
                        if(this.children[child].id === this.label + "-bufferSetPointsControls"){
                            bufferSetPointsControls = this.children[child];
                        }
                    }

                    // The week view showing data set points.
                    if(bufferSetPoints === null){
                        bufferSetPoints = document.createElement('div');
                        bufferSetPoints.id = this.label + "-bufferSetPoints";
                        bufferSetPoints.style["vertical-align"] = "bottom";
                        this.appendChild(bufferSetPoints);
                        // Note that we haven't populated this div yet.
                    }

                    // The buttons that we don't want to re-draw.
                    if(bufferSetPointsControls === null){
                        bufferSetPointsControls = document.createElement('div');
                        bufferSetPointsControls.id = this.label + "-bufferSetPointsControls";
                        bufferSetPointsControls.style["vertical-align"] = "bottom";
                        this.appendChild(bufferSetPointsControls);
                        bufferSetPointsControls.innerHTML = bufferSetPointsControlsTemplate({'unique_id': this.label,
                                                                                             'displaymax': parseInt(this.displaymax),
                                                                                             'displaymin': parseInt(this.displaymin),
                                                                                             'displaystep': parseFloat(this.displaystep)});
                    }

                    var time;
                    var displayStep = parseFloat(this.getAttribute('displayStep'));
                    if(dataStore.allDataContainer[this.label] !== undefined){
                        var populateForm = {};
                        populateForm.humanKey = {};
                        populateForm.data = {};

                        // Populate key data.
                        //dataStore.allDataContainer[this.label].humanKey = {};
                        for(time=0; time < 60*24; time += 60){
                            populateForm.humanKey[time] = Math.round(time / 60);
                        }

                        // Populate content data.
                        var maxValue, minValue, averageValue = 0, counterValues = 0, displayValue, actualValue;
                        for(time=0; time < 60*24*7; time += parseInt(this.stepsize)){
                            displayValue = (dataStore.allDataContainer[this.label][this.label][0][time] - parseInt(this.displaymin)) * parseInt(this.displayscale);
                            actualValue = Math.round(dataStore.allDataContainer[this.label][this.label][0][time] / displayStep) * displayStep;

                            populateForm.data[time] = [displayValue, actualValue];

                            counterValues += 1;
                            if(maxValue === undefined || maxValue < parseInt(actualValue)){
                                maxValue = parseInt(actualValue);
                            }
                            if(minValue === undefined || minValue > parseInt(actualValue)){
                                minValue = parseInt(actualValue);
                            }
                            averageValue += parseInt(actualValue);
                        }
                        averageValue /= counterValues;

                        // Populate other useful variables.
                        // Devide widths for sensible resolution when displayed.
                        populateForm.bufferMetadata = {'headerWidth': 60 / 2,
                                                       'cellWidth': parseInt(this.stepsize) / 2,
                                                       'displaymax': parseInt(this.displaymax),
                                                       'displaymin': parseInt(this.displaymin),
                                                       'displayscale': parseInt(this.displayscale),
                                                       'maxValue': maxValue,
                                                       'minValue': minValue,
                                                       'averageValue': averageValue,
                                                       'unique_id': this.label};
                        bufferSetPoints.innerHTML = bufferSetPointsTemplate(populateForm);

                        this.calculateAverageValue();
                        if(document.getElementById("set-" + this.label + "-modifyBufferButton")){
                            document.getElementById("set-" + this.label + "-modifyBufferButton").value = this.averageValue;
                        }
                    }
                    this.updateView('red');
                    //this.displayDrag();
                },
                calculateAverageValue: function() {
                    var displayStep = parseFloat(this.getAttribute('displayStep'));
                    var valueTotal = 0;
                    var valueCount = 0;
                    var time;
                    for(var i in this.selectedSetPoints){
                        time = this.selectedSetPoints[i];
                        if(dataStore.allDataContainer[this.label][this.label][0][time] !== undefined){
                            valueTotal += parseFloat(dataStore.allDataContainer[this.label][this.label][0][time]);
                            valueCount += 1;
                        }
                    }
                    this.averageValue = valueTotal / valueCount;
                    this.averageValue = Math.round(this.averageValue / displayStep) * displayStep;
                    if(!isNaN(this.averageValue)){
                        document.getElementById("set-" + this.label + "-modifyBufferButton").value = this.averageValue;
                    }
                },
                smooth: function(index){
                    //console.log('smooth');
                    this.serverLastQueriedAt = Date.now();  // Make sure new data is not loaded for a while.
                    this.selectedSetPointsDirty = true;  // Mark section for complete re-draw.
                    this.selectedSetPointsUnsaved = true;  // We have data to save.
                    this.calculateAverageValue();

                    var time;
                    for(var i in this.selectedSetPoints){
                        time = this.selectedSetPoints[i];
                        if(dataStore.allDataContainer[this.label][this.label][0][time] !== undefined){
                            dataStore.allDataContainer[this.label][this.label][0][time] = this.averageValue.toString();
                        }
                    }
                    this.draw();
                },
                setValue: function(){
                    //console.log('setValue');
                    this.serverLastQueriedAt = Date.now();  // Make sure new data is not loaded for a while.
                    this.selectedSetPointsDirty = true;  // Mark section for complete re-draw.
                    this.selectedSetPointsUnsaved = true;  // We have data to save.

                    this.averageValue = document.getElementById("set-" + this.label + "-modifyBufferButton").value;
                    //console.log("this.averageValue: ", this.averageValue);
                    for(var i in this.selectedSetPoints){
                        var time = this.selectedSetPoints[i];
                        if(dataStore.allDataContainer[this.label][this.label][0][time] !== undefined){
                            dataStore.allDataContainer[this.label][this.label][0][time] = this.averageValue.toString();
                        }
                    }
                    this.draw();
                },
                cancel: function(){
                    //console.log('cancel');
                    this.serverLastQueriedAt = Date.now() - 1000000;  // Make data reload next time the section is drawn.
                    this.selectedSetPointsDirty = true;  // Mark section for complete re-draw.
                    this.selectedSetPointsUnsaved = false;  // No data to save anymore.
                    this.updateData();                              // Do a DB lookup.
                },
                save: function(){
                    //console.log('save');
                    if(this.selectedSetPointsUnsaved !== true){
                        return;
                    }

                    var dataToSend = [{'type': 'cyclicBufferInput',
                        'data': {'key': this.label,
                            'label': this.label,
                            'val': dataStore.allDataContainer[this.label][this.label][0]
                        }
                    }];

                    dataStore.network.put(JSON.stringify(dataToSend), function(){this.updateData(true);}.bind(this));

                    this.selectedSetPointsUnsaved = false;  // No data to save anymore.
                },
                movmentWrapper: function(devId, clicked){
                    // Make sure we don't update things more often than reqired.
                    // Limit to a 50Hz cycle.
                    if(!this.queueUpdate){                
                        this.queueUpdate = true;
                        window.setTimeout(function(){this.movment(devId, clicked); this.queueUpdate = false;}.bind(this), 20);
                    }
                },
                movment: function(devId, clicked){
                    if(devId.split("-").length !== 3 ||
                            devId.split("-")[2] !== 'setPoints'){
                        return;
                    }

                    var index = devId.split("-")[0];

                    if(clicked){
                        var day = Math.floor(index / (60*24));
                        var time = index % (60*24);
                        console.log('dragging', devId, index, day, time, clicked, this.dragging);

                        if(!this.dragging){
                            // Just started dragging.
                            this.dragging = true;
                            this.dragStartDay = day;
                            this.dragStartTime = time;
                            this.clearSelected();
                        }
                        this.displayDrag(index);
                        this.lastValidIndex = index;
                    } else {
                        if(this.dragging){
                            console.log('dragging', devId, index, clicked, this.dragging);
                            // Just finished dragging.
                            delete this.dragging;
                            this.displayDrag(this.lastValidIndex);
                        }
                    }
                },
            }
        });
    })(xtag);

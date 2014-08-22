/* Return a colour appropriate for the angle requested. */
function colour(angle){
	'use strict';
	return 'hsl(' + (0.25 - angle/360/4) + ', 0.99, 0.5)';
}


/*
 * Args:
 *   label: Human readable unique identifier for this dial.
 *   paper: Underlying grapics library canvas to draw dial on.
 *   sensorList: List of unique identifiers for dial elements. These match the labels in the Mongo DB sensors_events table.
 *   centreX, centreY: Coordiantes of dial on paper.
 *   baseRadius: Radius on centre circle.
 *   lineThickness: Thickness of dial elements.
 *   lineSpacing: Distance between dial elements.
 *   temperatureMin, temperatureMax: Range temperatures are displayed between.
 *   updateDelay: Time delay between user input and callback function triggering in ms. Makes sure callback is not triggered many times while dial is moved.
 *   callback: Callback function triggered when dial is moved.
 */
function TemperatureSensor(label, paper, sensorList, centreX, centreY, baseRadius, lineThickness, lineSpacing, temperatureMin, temperatureMax, updateDelay, callback){
	'use strict';
	var dialSensitivity = 360 / (temperatureMax - temperatureMin);
	var dialOffset = temperatureMin * dialSensitivity;
	this.label = label;
	this.paper = paper;
	this.callback = callback;
	this.updateDelay = updateDelay;  // Time delay between user input and callback function triggering. (ms)
	this.elementList = [];
	var diamiter = baseRadius;
	this.sendUserInput = false;
	this.active = true;
	this.liveData = false;		// Set this true if dial is to be updated on a regular basis.
	this.elementList.push(new TemperatureSensorElement(label, 'set_' + label, 'bar', this.paper,
							   centreX, centreY, diamiter, lineThickness, dialSensitivity, dialOffset));
	for(var sensor in sensorList){
		diamiter += lineSpacing;
		this.elementList.push(new TemperatureSensorElement(label + '_' + sensorList[sensor], sensorList[sensor], 'arc',
								   this.paper, centreX, centreY, diamiter, lineThickness, dialSensitivity, dialOffset));
	}

	this.updateData();
}

TemperatureSensor.prototype.updateData = function(data){
	'use strict';
	if (typeof data === 'undefined'){
		// Data not specified so insert test data.
		data = {'00000536d60c':[20,1], 
		        '0000053610c1':[30,2]};
		data['set_'.concat(this.label)] = [0,1];
		console.log('inserting test data');
		console.log(data);
	} else if(typeof data === "boolean"){
		this.active = data;
		log(this.active, 'active0');
		return;
	} else {
		//console.log(data);
		this.liveData = true;
	}

	
	for(var key in this.elementList){
		var element = this.elementList[key];
		if(element.identifier in data){
			//console.log(key, element.identifier, element.userInput, data[element.identifier][0]);
			if(element.userInput === 1){
				// User has finnished adjusting controls but we don't want to update with received data
				// until our new data has been sent and received back from server.
				element.userInput = 0;
			} else if(element.userInput >= 1){
				// User still adjusting controls.
			} else {
				// User not adjusting controls. Free to display whatever the server thinks.
				element.updateData(data[element.identifier][0]);
			}
		}
	}
	if(this.sendUserInput === true){
		console.log('Sending: ', this.elementList[0].angleToTemperature(this.elementList[0].desiredAngle));

        var desiredTemperature = this.elementList[0].angleToTemperature(this.elementList[0].desiredAngle);
		this.callback(desiredTemperature, this.label);
	}
	this.sendUserInput = false;
};

TemperatureSensor.prototype.updateGraph = function(){
	'use strict';
	var totalTemp = 0, totalCount = 0;
	var element, key;
	var barElement = this.elementList[0];
    var anyDirty = false;

	for(key in this.elementList){
		element = this.elementList[key];

        if(element.dirty){
            anyDirty = true;
            // Update each element if required.
            element.updateGraph(this.active);
        }

		// Calculate average temperature of all inputs.
		if(key > 0){
			totalCount += 1;
			totalTemp += +element.temperature;
		}
	}
    log(anyDirty, 'Dial dirty');
    if(!anyDirty){return;}

	// Set colour of bar depending on whether it is higher or lower than the average input temp.
	if(barElement.temperature < totalTemp / totalCount){
		barElement.baseGradient = '90-#526c7a-#64a0c1';
	} else {
		barElement.baseGradient = '90-#c13629-#ff5032';
	}

	// If set teperature has been changed by user within the last cycle...
	if (barElement.userInput === 3){
		barElement.userInput = 2;
		if (typeof this.callback !== 'undefined'){
			clearTimeout(this.barTimeout);
			this.barTimeout = setTimeout(function(){this.sendUserInput = true; barElement.userInput = 1;}.bind(this), this.updateDelay);
		}
	}
};

/* A class for drawing 'rings' on the temperature sensor.
 * Args:
 *   type: 'arc' or 'bar'. 
 *         'arc' is a 'ring' around the outside of the dial for reperesenting
 *         temperatures.
 *         'bar' is a 'line' eminating from the centre of the dial intended as
 *         a controller to be dragged into position.
 */
function TemperatureSensorElement(label, identifier, type, paper, x, y, radius, thickness, dialSensitivity, dialOffset){
	'use strict';
	this.label = label;
	this.identifier = identifier;
	this.type = type;
	this.paper = paper;
	this.x = x;
	this.y = y;
	this.radius = radius;
	this.thickness = thickness;
	this.dialSensitivity = dialSensitivity;
	this.dialOffset = dialOffset;
	this.desiredAngle = 0;
	this.userInput = 0;
	this.temperature = 0;
    this.dirty = true;

	console.log('registerd TemperatureSensorElement: ' + identifier);
}
TemperatureSensorElement.prototype.temperatureToAngle = function(temperature){
	'use strict';
	return (temperature * this.dialSensitivity) - this.dialOffset;
};
TemperatureSensorElement.prototype.angleToTemperature = function(angle){
	'use strict';
	return ((angle + this.dialOffset) / this.dialSensitivity).toFixed(1);
};
TemperatureSensorElement.prototype.updateData = function(setTemp){
	'use strict';
	if (typeof setTemp !== 'undefined' && !(isNaN(setTemp))){
        this.dirty = false;
        if(Math.abs(this.temperature - setTemp) > 0.1){
            this.dirty = true;
        }

		if(this.type === 'bar'){
			this.desiredAngle = this.temperatureToAngle(setTemp);
		} else {
			this.temperature = setTemp;
		}
	}
};
TemperatureSensorElement.prototype.setInput = function(dx, dy){
	'use strict';
	this.userInput = 3;
    this.dirty = true;

	this.desiredAngle = Math.atan2(dx, -dy) * 180 / Math.PI;
	if(this.desiredAngle < 0){ this.desiredAngle = 360 + this.desiredAngle;}
};
TemperatureSensorElement.prototype.setUp = function(){
	'use strict';
    console.log('initialising pathObject');

    this.pathObject = this.paper.path();
    if(this.type === 'bar'){
        this.baseGradient = '90-#526c7a-#64a0c1';
        this.baseCircle = this.paper.circle(this.x, this.y, this.radius);
        this.baseCircle.attr({gradient: this.baseGradient});
        this.baseCircle.node.onmouseover = function(){
            this.style.cursor = 'pointer';
        };
        // .bind will only on modern brousers... but that's ok here as so will our graphics library...
        this.baseCircle.drag(this.setInput.bind(this), function(x, y){ /*drag start*/ }, function(){ /*ends*/ });
        this.baseCircle.toBack();

        this.pathObject.node.onmouseover = function(){
            this.style.cursor = 'pointer';
        };
        this.pathObject.drag(this.setInput.bind(this), function(x, y){ /*drag start*/ }, function(){ /*ends*/ });
    } else {
        // Draw dots allong path of temperature bar.
        var arkShaddow = this.paper.circle(this.x, this.y, this.radius);
        arkShaddow.toBack();
        arkShaddow.attr({'stroke-dasharray': '. ',});

        this.pathObject.node.onmouseover = function(){
        };
    }
};
TemperatureSensorElement.prototype.updateGraph = function(active){
    'use strict';
	var angleSet = this.temperatureToAngle(this.temperature);
	var _angle = angleSet * Math.PI / 180;

	if (typeof this.pathObject === 'undefined'){
		this.setUp();
	}

	// Set tooltip.
    this.pathObject.attr({ title: this.temperature });

    if(this.type === 'bar'){
        var sign = this.desiredAngle - angleSet;
        sign = sign && sign / Math.abs(sign);
        angleSet += 1 * sign;
        angleSet = (this.desiredAngle + (3 * angleSet)) / 4.0;

        if(Math.abs(angleSet - this.desiredAngle) > 1){
            this.dirty = true;
        }
        this.temperature = this.angleToTemperature(angleSet);

        this.baseCircle.attr({gradient: this.baseGradient});
    }

	var path;
	if (this.type === 'arc'){
		if (angleSet !== 360){
			path = [['M', this.x, this.y - this.radius],
			     ['A', this.radius, this.radius, 0, +(angleSet > 180), 1,
			     this.x + this.radius * Math.sin(_angle), this.y - this.radius * Math.cos(_angle)]];
		} else {
			path = [['M',this.x, this.y - this.radius],
			     ['A', this.radius, this.radius, 0, 0, 1, this.x -0.1, this.y + this.radius]];
		}
	} else if (this.type === 'bar'){
		path = [['M', this.x, this.y], ['L', this.x + this.radius * Math.sin(_angle), this.y - this.radius * Math.cos(_angle)]];
	}
	
	var currentColour = 'grey';
	if(active === true){
		currentColour = colour(angleSet);
	}
	this.pathObject.attr({'path': path,
			'stroke-linecap': 'round',
			'stroke': currentColour,
			'stroke-width': this.thickness});

	log(this.temperature, this.label);
};


// Functions for the "configure" page.

/* global Handlebars */
/* exported DisplaySettingsUpdate */

var mouseState = "up";

function mouseDown(ev) {
    'use strict';
    mouseState = "down";
    //do not write any code here in this function
}

function mouseUp(ev) {
    'use strict';
    mouseState = "up";
    //do not write any code here in this function
}

document.onmousedown = mouseDown;
document.onmouseup   = mouseUp;


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

Handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
    'use strict';
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
        
    return {
        "+": lvalue + rvalue,
        "-": lvalue - rvalue,
        "*": lvalue * rvalue,
        "/": lvalue / rvalue,
        "%": lvalue % rvalue
    }[operator];
});

function DisplaySettings(){
    'use strict';
    this.populateForm = {};
    this.userDevices = {};
    this.thermometers = {};

    this.selectedTemperatureSetPoints = [];
}

DisplaySettings.prototype.update = function(){
    'use strict';
    var main = document.getElementsByTagName("main")[0];

    var activeDevices = document.getElementById("activeDevices");
    if(activeDevices === null){
        activeDevices = document.createElement('x-registerDevices');
        activeDevices.id = "activeDevices";
        main.appendChild(activeDevices);
    }

    var bufferSetPoints = document.getElementById('bufferSetPoints');
    if(bufferSetPoints === null){
        bufferSetPoints = document.createElement('x-cyclicBuffer');
        bufferSetPoints.id = "bufferSetPoints";
        bufferSetPoints.label = "temp_setting_1_week";
        bufferSetPoints.stepsize = 15;
        bufferSetPoints.displaymax = 30;
        bufferSetPoints.displaymin = 10;
        bufferSetPoints.displayscale = 1;
        bufferSetPoints.displaystep = 0.5;
        main.appendChild(bufferSetPoints);
    }

    var usersSetHome = document.getElementById('usersSetHome');
    if(usersSetHome === null){
        usersSetHome = document.createElement('x-cyclicBuffer');
        usersSetHome.id = "usersSetHome";
        usersSetHome.label = "whos_home_1_week";
        usersSetHome.stepsize = 30;
        usersSetHome.displaymax = 1;
        usersSetHome.displaymin = 0;
        usersSetHome.displayscale = 20;
        usersSetHome.displaystep = 0.1;
        main.appendChild(usersSetHome);
    }
};

/* Wrapper arround an instance of the DisplaySettings calss so we can use it as a callback easily. */
var displaySettingsInstance = new DisplaySettings();
var DisplaySettingsUpdate = function(){
    'use strict';
    displaySettingsInstance.update();
};

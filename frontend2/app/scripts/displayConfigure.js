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

var DisplaySettingsUpdate = function(){
    'use strict';
    console.log('DisplaySettingsUpdate');
    var activeDevices = document.getElementById("activeDevices");
    var bufferSetPoints = document.getElementById("bufferSetPoints");
    var usersSetHome = document.getElementById("usersSetHome");
    if(activeDevices){
        activeDevices.updated = true;
    }
    if(bufferSetPoints){
        bufferSetPoints.updated = true;
    }
    if(usersSetHome){
        usersSetHome.updated = true;
    }
};

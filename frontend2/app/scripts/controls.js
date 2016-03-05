/* global dataStore */
/* global thermometerSvg */

/* exported displayTemperature */
/* exported roundSwitchInit */
/* exported loadTemplate */

// TypeDefs:
var displayTemperature, setThermometerTemp;

var controlSettings = {};

var DIALHEIGHT = 300;
var TEMPMAX_SCALE = 45;
var TEMPMIN_SCALE = 10;
var TEMPMAX_COLOR = 30;
var TEMPMIN_COLOR = 15;
var LOGMAX = Math.log(TEMPMAX_COLOR) *10;
var LOGMIN = Math.log(TEMPMIN_COLOR) *10;


function roundSwitchInit(){
    'use strict';

    var height = "60px";
    var width = "60px";

    var toggleSwitch = function(switchInstance){
        console.log(switchInstance);
        var switchId = switchInstance.target.id.slice(0, switchInstance.target.id.lastIndexOf("-"));

        if(controlSettings[switchId] === 0){
            if(controlSettings[switchId + "-secondary"] === 0){
                controlSettings[switchId] = 1;
            } else {
                controlSettings[switchId] = -1;
            }
        } else {
            controlSettings[switchId] = 0;
        }

        // Update the local cache.
        if(dataStore.allDataContainer.heatOnOff === undefined){
            dataStore.allDataContainer.heatOnOff = {};
        }
        dataStore.allDataContainer.heatOnOff.controler = [controlSettings[switchId], 0];

        // Update remote DB.
        var dataToSend = [{'type': 'userInput',
                           'data': {'key': switchId,
                                    'label': 'controler',
                                    'val': controlSettings[switchId]
                                   }
                         }];
        console.log("** sending: ", controlSettings[switchId]);
        //dataStore.serverConnectionsToSend.send("send", JSON.stringify(dataToSend), function(testvar){console.log(testvar);}, 6);
        dataStore.network.put(JSON.stringify(dataToSend), function(testvar){console.log(testvar);});

        // Redraw switch.        
        roundSwitchInit();
    };

    var drawCircle = function(context, diskColour, outlineColour){
        context.beginPath();
        var radius = Math.max(context.canvas.width, context.canvas.height) * 0.5;
        context.lineWidth = radius * 0.2;
        context.arc(context.canvas.width * 0.5, context.canvas.height * 0.5, radius * 0.9, 0, 2*Math.PI, false);
        context.strokeStyle = outlineColour;
        context.fillStyle = diskColour;

        context.fill();
        context.stroke();
        context.closePath();
    };

    // The HTML that makes up a switch.
    var switchHtml = "<div class='switch-footprint'><canvas width='" + width + "' height='" + height + "'></canvas></div>";

    var switches = document.getElementsByTagName("roundswitch");

    for(var sw = 0; sw < switches.length; sw++){

        var switchId = switches[sw].id;

        if(controlSettings[switchId] === undefined){
            controlSettings[switchId] = 0;
        }
        if(controlSettings[switchId + "-secondary"] === undefined){
            controlSettings[switchId + "-secondary"] = 0;
        }
        if(dataStore.allDataContainer.heatOnOff !== undefined && dataStore.allDataContainer.heatOnOff.controler !== undefined){
            controlSettings[switchId] = parseInt(dataStore.allDataContainer.heatOnOff.controler[0]);
        }
        if(dataStore.allDataContainer.heatOnOff !== undefined && dataStore.allDataContainer.heatOnOff.output !== undefined){
            controlSettings[switchId + "-secondary"] = parseInt(dataStore.allDataContainer.heatOnOff.output[0]);
        }

        switches[sw].innerHTML = switchHtml;
        switches[sw].getElementsByTagName("div")[0].id = switchId + "-outer";
        switches[sw].onclick = toggleSwitch;

        var canvas = switches[sw].getElementsByTagName("canvas")[0];
        canvas.id = switchId + "-canvas";
        var context = canvas.getContext('2d');

        var diskColour = "grey";
        var outlineColour = "grey";
        if(controlSettings[switchId] === 1){
            diskColour = "red";
        } else if(controlSettings[switchId] === -1){
            diskColour = "blue";
        }
        if(controlSettings[switchId + "-secondary"] === 1){
            outlineColour = "red";
        } else if(controlSettings[switchId + "-secondary"] === 0){
            outlineColour = "blue";
        }

        drawCircle(context, diskColour, outlineColour);
    }
}

function displayTemperature(){
    'use strict';

    function filterData(inputData){
        var retData = [];
        for(var i in inputData){
            if(inputData[i]["1wire"] !== undefined){
                retData[i] = inputData[i];
            }
        }
        return retData;
    }

    var svgTest = document.getElementById("dialsSvg");
    if(svgTest === null){
      // Thermomitor picture not loaded yet.
      return;
    }
    svgTest.setAttribute("height", DIALHEIGHT);
    var index = 0;
    var newThermometer, oldThermometer, key;
    for(key in filterData(dataStore.allDataContainer)){
        oldThermometer = svgTest.getElementById("thermometer-" + key);
        newThermometer = setThermometerTemp(dataStore.allDataContainer[key], index);
        if(newThermometer){
            newThermometer.id = "thermometer-" + key;

            if(oldThermometer === null){
                svgTest.appendChild(newThermometer);
            }else{
                svgTest.replaceChild(newThermometer, oldThermometer);
            }
        }
        index += 1;
    }
    return;
}


var loadTemplate = function(filename){
        'use strict';
        // This function blocks untill template is loaded.
        console.log('loadTemplate:', filename);
        var ajax = new XMLHttpRequest();
        ajax.open("GET", filename, false);
        ajax.send();
        return ajax.responseText;
};

setThermometerTemp = function(d, i){
    'use strict';

    if(!thermometerSvg){
        return;
    }
    var hue;
    var temperature = d["1wire"][0];

    if(temperature > TEMPMAX_SCALE){ temperature = TEMPMAX_SCALE; }

    if("temperatureColourLogScale" in controlSettings && controlSettings.temperatureColourLogScale === 1){
        hue = (240 * (LOGMAX - Math.log(temperature) *10) / (LOGMAX - LOGMIN));
    } else {
        hue = (240 * (TEMPMAX_COLOR - temperature) / (TEMPMAX_COLOR - TEMPMIN_COLOR));
        
    }
    if(hue > 256){ hue = 256; }
    if(hue < 0){ hue = 0; }

    var fillStyle = 'hsl(' + [hue, '70%', '50%'] + ')';

    var thermometerTube8unit = thermometerSvg.getElementById("thermometerTube8unit");
    var thermometerTube16unit = thermometerSvg.getElementById("thermometerTube16unit");
    var thermometerTube32unit = thermometerSvg.getElementById("thermometerTube32unit");

    thermometerSvg.getElementById("thermometerBulb").setAttribute("fill", fillStyle);

    thermometerTube8unit.setAttribute("fill", fillStyle);
    thermometerTube16unit.setAttribute("fill", fillStyle);
    thermometerTube32unit.setAttribute("fill", fillStyle);

    thermometerTube8unit.style.display="none";
    thermometerTube16unit.style.display="none";
    thermometerTube32unit.style.display="none";

    var transform = "translate(0, " + (5 * (TEMPMIN_SCALE - temperature) -5) + ")";

    if(temperature >= 10 && temperature < 16){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", transform);
    } else if(temperature >= 16 && temperature < 31.5){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", "translate(0, -35)");
        thermometerTube16unit.style.display="inline";
        thermometerTube16unit.setAttribute("transform", transform);
    } else if(temperature >= 31.5){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", "translate(0, -31)");
        thermometerTube32unit.style.display="inline";
        thermometerTube32unit.setAttribute("transform", transform);
    }

    thermometerSvg.getElementById("tempValue").getElementsByTagName("tspan")[0].innerHTML = (Math.round(temperature * 10) / 10) + "°C";

    return thermometerSvg;
};


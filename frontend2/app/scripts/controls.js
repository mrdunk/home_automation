
var controlSettings = {};

var FADETIME = 200;
var DIALHEIGHT = 300;
var DIALMARGIN = 10;
var TEMPMAX_SCALE = 45;
var TEMPMIN_SCALE = 10;
var TEMPMAX_COLOR = 30;
var TEMPMIN_COLOR = 15;
var LOGMAX = Math.log(TEMPMAX_COLOR) *10;
var LOGMIN = Math.log(TEMPMIN_COLOR) *10;

function preventBehavior(e) {
    e.preventDefault(); 
}

var changeColourGreen = function(switchInstance){
    switchInstance.target.classList.remove("switch-unselected");
    switchInstance.target.classList.add("switch-selected");
};

var changeColourGrey = function(switchInstance){
    switchInstance.target.classList.remove("switch-selected");
    switchInstance.target.classList.add("switch-unselected");
};

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
        roundSwitchInit();
        console.log(controlSettings);
        var dataToSend = [{'type': 'userInput',
                           'data': {'key': switchId,
                                    'val': controlSettings[switchId]
                                   }
                         }];
        dataStore.serverConnectionsToSend.send("send", JSON.stringify(dataToSend), function(testvar){console.log(testvar);}, 6);
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
        }

        drawCircle(context, diskColour, outlineColour);
    }
}

function verticalSwitchInit(){
    'use strict';

    var height = "44px";
    var width = "20px";

    var toggleSwitch = function(switchInstance){
        console.log(switchInstance);
        var switchId = switchInstance.target.id.slice(0, switchInstance.target.id.lastIndexOf("-"));
        console.log(switchId);
        if(controlSettings[switchId] === undefined || controlSettings[switchId] === 0){
            controlSettings[switchId] = 1;
            document.getElementById(switchId).getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.top = "20px";
        } else {
            controlSettings[switchId] = 0;
            document.getElementById(switchId).getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.top = "0px";
        }
    };

    // The HTML that makes up a switch.
    var switchHtml = "<div class='switch-footprint'><div class='switch-outer switch-unselected'><div class='switch-inner'></div></div></div>";

    var switches = document.getElementsByTagName("verticalswitch");

    for(var sw = 0; sw < switches.length; sw++){    
        switches[sw].innerHTML = switchHtml;
        switches[sw].getElementsByTagName("div")[0].id = switches[sw].id + "-footprint";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].id = switches[sw].id + "-outer";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].id = switches[sw].id + "-inner";
        switches[sw].getElementsByTagName("div")[0].style.width = width;
        switches[sw].getElementsByTagName("div")[0].style.height = height;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onmouseover = changeColourGreen;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onmouseleave = changeColourGrey;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onclick = toggleSwitch;
    }
}

var verticalSliderStoreYPos;    // Tempory storage while a slider is being dragged.
/* An analouge slider. */
var verticalSliderUpdate = [];
function verticalSliderInit(){
    'use strict';

    var height = 200;
    var width = 30;
    var slideHeight = (200 - 6) * 0.8;      // (height - (2 * border)) * ((height - knob_height) / height)
    var heightPx = height + "px";
    var widthPx = width + "px";
    var maxVal = 42;
    var minVal = 5;
    var rangeVal = minVal - maxVal;
    var scaledVal;


    // Called while slider is being dragged.
    function dragSlider(switchInstance){
        console.log("dragSlider");
        var switchId;
        if(switchInstance.target === undefined){
            switchId = switchInstance.id;
        } else {
            switchId = switchInstance.target.id;
        }

        var x,y;
        if(switchInstance.clientX && switchInstance.clientY){
            // This is a mouse event.
            x = switchInstance.clientX;
            y = switchInstance.clientY;
            console.log(x,y);
        } else if(switchInstance.touches !== undefined) {
            // Touch event.
            x = switchInstance.touches[0].pageX;
            y = switchInstance.touches[0].pageY;
        } else {
            if(verticalSliderStoreYPos === undefined){
                y = maxVal;
                verticalSliderStoreYPos = y;
            } else {
                return;
            }
        }

        var pos = switchId.lastIndexOf("-");
        if(pos > -1){
            switchId = switchId.substr(0, pos);
        }

        controlSettings[switchId] += (y - verticalSliderStoreYPos) * rangeVal / slideHeight;

        if(controlSettings[switchId] < minVal) controlSettings[switchId] = minVal;
        if(controlSettings[switchId] > maxVal) controlSettings[switchId] = maxVal;
        verticalSliderStoreYPos = y;

        function doTheThings(_switchId){
            var node = document.getElementById(_switchId);
            node.getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.top =
                ((controlSettings[switchId] - maxVal) * slideHeight / rangeVal) + "px";

            node.getElementsByTagName("p")[0].innerHTML = (Math.round(controlSettings[switchId] * 10) / 10) + "°C";

            displayTemperature();
            
            delete verticalSliderUpdate[_switchId];
        }

        // We don't want to update things every time a drag event is detected.
        // Insstead do it every 20ms.
        if(verticalSliderUpdate[switchId] === undefined){
            verticalSliderUpdate[switchId] = setTimeout(function(){ doTheThings(switchId); }, 20);
        }

    }

    // Called when slider is first dragged.
    function dragSliderStart(switchInstance){
        var x,y;
        if(switchInstance.clientX !== undefined && switchInstance.clientY !== undefined){
            console.log("dragSliderStart click");
            //var crt = this.cloneNode(true);
            //crt.style.backgroundColor = "black";
            //crt.innerHTML = "";
            //crt.style.position = "absolute"; crt.style.top = "0px"; crt.style.right = "0px";
            //crt.style.height = "20px";
            //crt.style.width = widthPx;
            //document.body.appendChild(crt);
            //switchInstance.dataTransfer.setDragImage(crt, 0, 0);
            
            x = switchInstance.clientX;
            y = switchInstance.clientY;
        } else {
            console.log("dragSliderStart touch");
            x = switchInstance.changedTouches[0].pageX;
            y = switchInstance.changedTouches[0].pageY;
        }
        verticalSliderStoreYPos = y;
    }

    // The HTML that makes up a switch.
    var switchHtml = "<div class='switch-footprint'><div class='switch-outer switch-unselected'>" +
                     "<div class='slider-inner'></div></div><div><p class='switch-display'></p></div></div>";

    // Fetch all sliders.
    var switches = document.getElementsByTagName("verticalslider");

    for(var sw = 0; sw < switches.length; sw++){
        if(controlSettings[switches[sw].id] === undefined){
            controlSettings[switches[sw].id] = minVal;
        }
        switches[sw].innerHTML = switchHtml;
        switches[sw].getElementsByTagName("div")[0].id = switches[sw].id + "-footprint";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].id = switches[sw].id + "-outer";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].id = switches[sw].id + "-inner";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.width = widthPx;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.height = heightPx;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onmouseover = changeColourGreen;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onmouseleave = changeColourGrey;

        // Mouse click events
        switches[sw].ondrag = dragSlider;
        switches[sw].draggable = true;
        switches[sw].ondragstart = dragSliderStart;

        // Mobile touch events.
        switches[sw].ontouchmove = dragSlider;
        switches[sw].ontouchstart = dragSliderStart;
       
        // Don't scroll screen when clicking/touching slider.
        switches[sw].addEventListener("touchmove", preventBehavior, false);

        // Draw slider in starting position.
        dragSlider(switches[sw]);
    }
}

function whoshome(clear){
    'use strict';

    var onClick = function(pictureId){
        d3.select("main").select("#people").selectAll("div")
            .transition()
            .duration(FADETIME)
            .style("-webkit-transform", "scale(0)")
            .each("end", function(){displayUser(pictureId);});
    };

    if(clear){
        // Remove all pre-existing so transitions work.
        d3.select("main").select("#people").selectAll("div").remove();
    }

    var workspace = d3.select("main").select("#people").selectAll("div")
        .data(d3.entries(dataStore.userDataContainer));

    workspace.html(userBriefTemplate)
        .attr("class", "whosHome")
        .on("click", onClick)
        .style("-webkit-transform", "scale(1)");

    workspace.enter()
        .append("div")
        .html(userBriefTemplate)
        .attr("class", "whosHome")
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)")
        .transition()
        .duration(FADETIME)
        .style("-webkit-transform", "scale(1)");

    workspace.exit()
        .remove();
    
}

function displayUser(userData){
    'use strict';
    var onClick = function(pictureId){
        // Click anywhere on the popup to restore view of all users.
        d3.select("main").select("#people").selectAll("div")
            .transition()
            .duration(FADETIME)
            .style("-webkit-transform", "scale(0)")
            .each("end", function(){whoshome(true);});
    };

    // Remove all pre-existing so transitions work.
    d3.select("main").select("#people").selectAll("div").remove();

    var workspace = d3.select("main").select("#people").selectAll("div").data([userData]);

    workspace.html(userInfoTemplate)
        .attr("class", "displayUser")
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)");

    workspace.enter()
        .append("div")
        .attr("class", "displayUser")
        .html(userInfoTemplate)
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)");

    workspace.transition()
        .duration(FADETIME)
        .style("-webkit-transform", "scale(1)");

    workspace.exit()
        .remove();
}

function displayTemperature(){
    'use strict';
    //var workspace = document.getElementById("dials");
    //var html = teperaturesTemplate(dataStore.allDataContainer);
    //workspace.innerHTML = html;

    var svg = d3.select("main").select("#dials").select("svg");
    svg.attr("height", DIALHEIGHT)
        .attr("width", "100%");

    function filterData(inputData){
        var retData = [];
        for(var i in inputData){
            if(inputData[i]["1wire"] !== undefined){
                retData[i] = inputData[i];
            }
        }
        retData.test = {"1wire": [controlSettings.setTemperatureSlider, 0]};
        return retData;
    }


    var thermometers = svg.selectAll(".thermometer")
        .data(d3.entries(filterData(dataStore.allDataContainer)));

    thermometers.html(setThermometerTemp);

    thermometers.enter().append("svg")
        .attr("class", "thermometer")
        .attr("x", function(d,i){return 100*i;})
        .html(setThermometerTemp);

    thermometers.exit()
        .remove();
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

function setThermometerTemp(d, i){
    if(thermometerSvg === undefined){
        return;
    }
    var hue;
    var temperature = d.value["1wire"][0];

    if(temperature > TEMPMAX_SCALE) temperature = TEMPMAX_SCALE;

    if("temperatureColourLogScale" in controlSettings && controlSettings.temperatureColourLogScale === 1){
        hue = (240 * (LOGMAX - Math.log(temperature) *10) / (LOGMAX - LOGMIN));
    } else {
        hue = (240 * (TEMPMAX_COLOR - temperature) / (TEMPMAX_COLOR - TEMPMIN_COLOR));
        
    }
    if(hue > 256) hue = 256;
    if(hue < 0) hue = 0;

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

    return thermometerSvg.innerHTML;
}

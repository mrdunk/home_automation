
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
};

document.addEventListener("touchmove", preventBehavior, false);


var changeColourGreen = function(switchInstance){
    switchInstance.target.classList.remove("switch-unselected");
    switchInstance.target.classList.add("switch-selected");
};

var changeColourGrey = function(switchInstance){
    switchInstance.target.classList.remove("switch-selected");
    switchInstance.target.classList.add("switch-unselected");
};

function verticalSwitchInit(){
    'use strict';

    var height = "44px";
    var width = "20px";
    var names = [];

    var toggleSwitch = function(switchInstance){
        console.log(switchInstance);
        var switchId = switchInstance.target.id.slice(0, switchInstance.target.id.lastIndexOf("-"));
        console.log(switchId);
        if(controlSettings[switchId] === undefined || controlSettings[switchId] === 0){
            controlSettings[switchId] = 1;
            document.getElementById(switchId).getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.top = "20px"
        } else {
            controlSettings[switchId] = 0;
            document.getElementById(switchId).getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.top = "0px"
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
    };
}

var verticalSliderStoreYPos;    // Tempory storage while a slider is being dragged.
function verticalSliderInit(){
    'use strict';

    var height = 200;
    var width = 20;
    var heightPx = height + "px";
    var widthPx = width + "px";

    // Called while slider is being dragged.
    function dragSlider(switchInstance){
        if(switchInstance.clientX && switchInstance.clientY){
            var switchId = switchInstance.target.id.slice(0, switchInstance.target.id.lastIndexOf("-"));
            console.log(switchId, switchInstance.clientY - verticalSliderStoreYPos, controlSettings[switchId]);

            controlSettings[switchId] += switchInstance.clientY - verticalSliderStoreYPos;
            if(controlSettings[switchId] < 0) controlSettings[switchId] = 0;
            if(controlSettings[switchId] > 100) controlSettings[switchId] = 100;
            verticalSliderStoreYPos = switchInstance.clientY;
            document.getElementById(switchId).getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].style.top =
                controlSettings[switchId] * (height -6) * 0.8 / 100 + "px";

            displayTemperature();
        }
    }

    // Called when slider is first dragged.
    function dragSliderStart(switchInstance){
        var crt = this.cloneNode(true);
        crt.style.backgroundColor = "black";
        crt.innerHTML = "";
        crt.style.position = "absolute"; crt.style.top = "0px"; crt.style.right = "0px";
        crt.style.height = "20px";
        crt.style.width = widthPx;
        document.body.appendChild(crt);
        switchInstance.dataTransfer.setDragImage(crt, 0, 0);

        verticalSliderStoreYPos = switchInstance.clientY;
    }

    // The HTML that makes up a switch.
    var switchHtml = "<div class='switch-footprint'><div class='switch-outer switch-unselected'><div class='slider-inner'></div></div></div>";

    // Fetch all sliders.
    var switches = document.getElementsByTagName("verticalslider");

    for(var sw = 0; sw < switches.length; sw++){
        if(controlSettings[switches[sw].id] === undefined){
            controlSettings[switches[sw].id] = 0;
        }
        switches[sw].innerHTML = switchHtml;
        switches[sw].getElementsByTagName("div")[0].id = switches[sw].id + "-footprint";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].id = switches[sw].id + "-outer";
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].getElementsByTagName("div")[0].id = switches[sw].id + "-inner";
        switches[sw].getElementsByTagName("div")[0].style.width = widthPx;
        switches[sw].getElementsByTagName("div")[0].style.height = heightPx;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onmouseover = changeColourGreen;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].onmouseleave = changeColourGrey;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].ondrag = dragSlider;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].draggable = true;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].ondragstart = dragSliderStart;

        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].ontouchmove = dragSlider;
        switches[sw].getElementsByTagName("div")[0].getElementsByTagName("div")[0].ontouchstart = function(switchInstance){verticalSliderStoreYPos = switchInstance.clientY;};
    };
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
        retData['test'] = {"1wire": [(100 - controlSettings["setTemperatureSlider"]) / 2, 0]};
        console.log(retData);
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
    
    var temperature = d.value["1wire"][0];

    if(temperature > TEMPMAX_SCALE) temperature = TEMPMAX_SCALE;

    if("temperatureColourLogScale" in controlSettings && controlSettings.temperatureColourLogScale === 1){
        console.log("Log scale colour.");
        var hue = (240 * (LOGMAX - Math.log(temperature) *10) / (LOGMAX - LOGMIN));
    } else {
        console.log("Linear scale colour.");
        var hue = (240 * (TEMPMAX_COLOR - temperature) / (TEMPMAX_COLOR - TEMPMIN_COLOR));
        
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
console.log("hue: ", hue);

    if(temperature >= 10 && temperature < 16){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", transform);
    } else if(temperature >= 16 && temperature < 32){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", "translate(0, -35)");
        thermometerTube16unit.style.display="inline";
        thermometerTube16unit.setAttribute("transform", transform);
    } else if(temperature >= 32){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", "translate(0, -31)");
        thermometerTube32unit.style.display="inline";
        thermometerTube32unit.setAttribute("transform", transform);
    }

    thermometerSvg.getElementById("tempValue").getElementsByTagName("tspan")[0].innerHTML = temperature + "°C";

    console.log(temperature);
    return thermometerSvg.innerHTML;
}


var controlSettings = {};

var FADETIME = 200;
var DIALHEIGHT = 300;
var DIALMARGIN = 10;
var TEMPMAX = 40;
var TEMPMIN = 10;
var LOGMAX = Math.log(TEMPMAX) *10;
var LOGMIN = Math.log(TEMPMIN) *10;

function verticalSwitchInit(){
    'use strict';

    var height = "44px";
    var width = "20px";
    var names = [];

    var changeColourGreen = function(switchId){
        d3.select(this).style({"background-color": "green", "border-color": "green"});
        d3.event.stopPropagation();
    };

    var changeColourGrey = function(switchId){
        d3.select(this).style({"background-color": "grey", "border-color": "grey"});
        d3.event.stopPropagation();
    };

    var toggleSwitch = function(switchId){
        console.log(switchId);
        if(controlSettings[switchId] === undefined || controlSettings[switchId] === 0){
            controlSettings[switchId] = 1;
            d3.select("main").select("#" + switchId).select("#inner").style({"position": "relative", "top": "20px"});
        } else {
            controlSettings[switchId] = 0;
            d3.select("main").select("#" + switchId).select("#inner").style({"position": "relative", "top": "0px"});
        }
    };

    // The HTML that makes up a switch.
    var switchHtml = "<div id='footprint' style='float: left;'><div id='outer'><div id='inner'></div></div></div>";

    var switches = d3.select("main").selectAll("verticalswitch");

    // Ugly hack to get id-s of all switches.
    switches.forEach(function(v,i,a){
                        v.forEach(function test(vv,ii,aa){
                                    names.push(vv.id);
                                  });
                     });

    switches.data(names)
        .html(switchHtml);

    switches.select("#footprint")
        .style({"width": width, "height": height, "padding": "1px"});

    switches.select("#outer")
        .style({"background-color": "grey", "width": "100%", "height": "100%", "border": "2px solid", "border-color": "grey", "border-radius": "4px"})
        .on("mouseover", changeColourGreen)
        .on("mouseout", changeColourGrey)
        .on("click", toggleSwitch)
        .select("#inner")
        .style({"background-color": "black", "width": "80%", "height": "40%", "border-radius": "4px", "margin-left": "auto", "margin-right": "auto"});

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

    if("temperatureColourLogScale" in controlSettings && controlSettings.temperatureColourLogScale === 1){
        console.log("Log scale colour.");
        var hue = (240 * (LOGMAX - Math.log(temperature) *10) / (LOGMAX - LOGMIN));
        var hue2 = (240 * (TEMPMAX - temperature) / (TEMPMAX - TEMPMIN));
    } else {
        console.log("Linear scale colour.");
        var hue = (240 * (TEMPMAX - temperature) / (TEMPMAX - TEMPMIN));
        var hue2 = (240 * (TEMPMAX - temperature) / (TEMPMAX - TEMPMIN));
    }
    console.log(hue, hue2);
    var fillStyle = 'hsl(' + [hue, '70%', '50%'] + ')';
    var fillStyle2 = 'hsl(' + [hue2, '70%', '50%'] + ')';

    var thermometerTube8unit = thermometerSvg.getElementById("thermometerTube8unit");
    var thermometerTube16unit = thermometerSvg.getElementById("thermometerTube16unit");
    var thermometerTube32unit = thermometerSvg.getElementById("thermometerTube32unit");

    thermometerSvg.getElementById("thermometerBulb").setAttribute("fill", fillStyle2);

    thermometerTube8unit.setAttribute("fill", fillStyle);
    thermometerTube16unit.setAttribute("fill", fillStyle);
    thermometerTube32unit.setAttribute("fill", fillStyle);

    thermometerTube8unit.style.display="none";
    thermometerTube16unit.style.display="none";
    thermometerTube32unit.style.display="none";

    var transform = "translate(0, " + (5.2 * (TEMPMIN - temperature)) + ")";

    if(temperature >= 10 && temperature < 20){
        thermometerTube8unit.style.display="inline";
        thermometerTube8unit.setAttribute("transform", transform);
    } else if(temperature >= 20 && temperature < 30){
        thermometerTube16unit.style.display="inline";
        thermometerTube16unit.setAttribute("transform", transform);
    } else if(temperature >= 30){
        thermometerTube32unit.style.display="inline";
        thermometerTube32unit.setAttribute("transform", transform);
    }

    thermometerSvg.getElementById("tempValue").getElementsByTagName("tspan")[0].innerHTML = temperature + "°C";

    console.log(temperature);
    return thermometerSvg.innerHTML;
}

/* global GetAuthKey */
/* global loadTemplate */
/* global Handlebars */
/* global DataStore */
/* global d3 */
/* global roundSwitchInit */
/* global displayTemperature  */
/* global whoshome */
/* global DisplaySettingsUpdate */
/* global UpdateGraphs */

/*exported AuthKey */
/*exported serverFQDN1 */
/*exported serverFQDN2 */
/*exported appEngineFQDN */
/*exported userInfoTemplate */
/*exported userInfoTemplate2 */
/*exported teperaturesTemplate */
/*exported userBriefTemplate */
/*exported displayControlTemplate */
/*exported displayConfigureTemplate */
/*exported bufferSetPointsTemplate */
/*exported bufferSetPointsControlsTemplate */
/*exported dataStore */


var AuthKey = GetAuthKey();

var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';
var appEngineFQDN = 'home-automation-7.appspot.com';

//var tempSensorList = ['00000536d60c', '0000053610c1', '00000536b89a'];

var userInfoTemplate = Handlebars.compile(loadTemplate("userInfo.template"));
var teperaturesTemplate = Handlebars.compile(loadTemplate("teperatures.template"));
var userBriefTemplate = Handlebars.compile(loadTemplate("userBrief.template"));
var displayControlTemplate = Handlebars.compile(loadTemplate("displayControl.template"));
var displayConfigureTemplate = Handlebars.compile(loadTemplate("displayConfigure.template"));
var bufferSetPointsTemplate = Handlebars.compile(loadTemplate("bufferSetPoints.template"));
var bufferSetPointsControlsTemplate = Handlebars.compile(loadTemplate("bufferSetPointsControls.template"));
var userInfoTemplate2 = Handlebars.compile(loadTemplate("userInfo2.template"));

var dataStore = new DataStore();

var thermometerSvg;
d3.xml("thermometer.svg", "image/svg+xml", function(xml) {
    'use strict';
    thermometerSvg = document.importNode(xml.documentElement, true);
    //console.log(thermometerSvg.getElementById("tempValue"));
    //console.log(thermometerSvg.getElementById("tempValue").innerHTML);
    //console.log(thermometerSvg.getElementById("tempValue").getElementsByTagName("tspan")[0].innerHTML = "10°C");
});

d3.ns.prefix.inkscape = "http://www.inkscape.org/namespaces/inkscape";


window.onload = function () {
    'use strict';
    console.log('window.onload');
    //location.hash = 'control';
    window.onhashchange();

    //var main = d3.select("main");
    //main.style("background-color", "white");

    //main.transition()
    //    .duration(2000)
    //    .style("background-color", "lightgrey");
};

var displayControl = function () {
    'use strict';
    var controls = document.getElementById('controls');
    controls.style.display = "block";
    controls.innerHTML = displayControlTemplate({});

    roundSwitchInit();

    dataStore.registerCallbacks([displayTemperature, whoshome, roundSwitchInit]);
};

var displayConfigure = function () {
    'use strict';
    console.log('displayConfigure()');

    document.getElementById('activeDevices').style.display = "block";
    document.getElementById('bufferSetPoints').style.display = "block";
    document.getElementById('usersSetHome').style.display = "block";

    dataStore.registerCallbacks([DisplaySettingsUpdate]);
};


var displayGraphs = function () {
    'use strict';
    console.log('displayGraphs()');

    var graph = document.getElementById('graph');
    graph.style.display = "block";

    dataStore.registerCallbacks([UpdateGraphs]);
};

var test = function(){
    'use strict';
    console.log('test()');

    var whoshome = document.getElementById("whosHome");
    whoshome.style.display = "block";
    document.getElementById("whosHome").updated = "true";
    dataStore.registerCallbacks([function(){whoshome.updated = "true";}]);
};

var displayEmpty = function () {
    'use strict';
    //var main = document.getElementsByTagName("main")[0];
    //main.innerHTML = 'content missing';
};

window.onhashchange = function () {
    'use strict';
    
    dataStore.registerCallbacks([]);

    var main = document.getElementsByTagName("main")[0];
    for(var child in main.children){
        if(main.children[child].style){
            main.children[child].style.display = "none";
        }
    }
    //purge(main);
    //removeChildren(main);

    /*var main2 = d3.select("main");
    main2.style("background-color", "white");*/

    if(location.hash === '#control'){
        displayControl();
    } else if(location.hash === '#config'){
        displayConfigure();
    } else if(location.hash === '#graphs'){
        displayGraphs();
    } else if(location.hash === '#test'){
        test();
    } else {
        displayEmpty();
    }

    /*main2.transition()
        .duration(2000)
        .style("background-color", "lightgrey");*/
};


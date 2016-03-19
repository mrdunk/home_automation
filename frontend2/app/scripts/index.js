/* global GetAuthKey */
/* global loadTemplate */
/* global Handlebars */
/* global DataStore */
/* global d3 */
/* global roundSwitchInit */
/* global displayTemperature  */
/* global displaySettingsUpdate */
/* global updateGraphs */
/* global updateWhoshome */
/* global setVacation */

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

var teperaturesTemplate = Handlebars.compile(loadTemplate("temperatures.template"));
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
    location.hash = 'control';
    window.onhashchange();
};

var displayControl = function () {
    'use strict';
    console.log('displayControl()');

    var controls = document.getElementById('controls');
    controls.style.display = "block";
    controls.innerHTML = displayControlTemplate({});

    var whoshome = document.getElementById("whosHome");
    if(whoshome){
        whoshome.style.display = "block";
        document.getElementById("whosHome").updated = "true";
    }

    roundSwitchInit();
    displayTemperature();
    updateWhoshome();
    dataStore.registerCallbacks([updateWhoshome, displayTemperature, roundSwitchInit]);
};

var displayConfigure = function () {
    'use strict';
    console.log('displayConfigure()');

    var registerDevices = document.getElementById('registerDevices');
    if(registerDevices){
        registerDevices.style.display = "block";
    }

    var bufferSetPoints = document.getElementById('bufferSetPoints');
    if(bufferSetPoints){
        bufferSetPoints.style.display = "block";
    }

    var usersSetHome = document.getElementById('usersSetHome');
    if(usersSetHome){
        usersSetHome.style.display = "block";
    }

    displaySettingsUpdate();
    dataStore.registerCallbacks([displaySettingsUpdate]);
};

var displayGraphs = function(){
    'use strict';

    var graph2 = document.getElementById('graph2');
    if(graph2){
        graph2.style.display = "block";
        updateGraphs();  // Update now.
        dataStore.registerCallbacks([updateGraphs]);
    }
};

var displayEmpty = function () {
    'use strict';
    //var main = document.getElementsByTagName("main")[0];
    //main.innerHTML = 'content missing';
};

window.onhashchange = function () {
    'use strict';
    console.log('window.onhashchange()', location.hash);

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
    } else if(location.hash === '#onHoliday'){
        setVacation(1);
    } else if(location.hash === '#offHoliday'){
        setVacation(0);
    } else {
        displayEmpty();
    }

    /*main2.transition()
        .duration(2000)
        .style("background-color", "lightgrey");*/
};

var AuthKey = GetAuthKey();


var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';
var appEngineFQDN = 'home-automation-7.appspot.com';

var tempSensorList = ['00000536d60c', '0000053610c1'];

var userInfoTemplate = Handlebars.compile(loadTemplate("userInfo.template"));
var teperaturesTemplate = Handlebars.compile(loadTemplate("teperatures.template"));
var userBriefTemplate = Handlebars.compile(loadTemplate("userBrief.template"));
var displayControlTemplate = Handlebars.compile(loadTemplate("displayControl.template"));
var displayConfigureTemplate = Handlebars.compile(loadTemplate("displayConfigure.template"));

var dataStore = new DataStore();

var thermometerSvg;
d3.xml("thermometer.svg", "image/svg+xml", function(xml) {
    thermometerSvg = document.importNode(xml.documentElement, true);
    //console.log(thermometerSvg.getElementById("tempValue"));
    //console.log(thermometerSvg.getElementById("tempValue").innerHTML);
    //console.log(thermometerSvg.getElementById("tempValue").getElementsByTagName("tspan")[0].innerHTML = "10°C");
});

d3.ns.prefix.inkscape = "http://www.inkscape.org/namespaces/inkscape";


window.onload = function () {
    'use strict';
    console.log('window.onload');
    //location.hash = 'startup';

    var main = d3.select("main");
    main.style("background-color", "white");

    main.transition()
        .duration(2000)
        .style("background-color", "lightgrey");


    verticalSwitchInit();
    verticalSliderInit();
    roundSwitchInit();
};

window.onhashchange = function () {
    'use strict';
    console.log(location.hash);

    var main = d3.select("main");
    main.style("background-color", "white");

    if(location.hash === '#control'){
        displayControl();
    } else if(location.hash === '#config'){
        displayConfigure();
    } else {
        displayEmpty();
    }

    main.transition()
        .duration(2000)
        .style("background-color", "lightgrey");
};

var displayControl = function () {
    var main = document.getElementsByTagName("main")[0];
    main.innerHTML = displayControlTemplate({});

    verticalSwitchInit();
    verticalSliderInit();
    roundSwitchInit();

    displayTemperature();
    whoshome(false);
};

var displayConfigure = function () {
    var main = document.getElementsByTagName("main")[0];

    var userDevices = {};
    var thermomiters = {};
    for(var device in dataStore.allDataContainer){
        if(dataStore.allDataContainer[device]['1wire'] === undefined){
            userDevices[device] = dataStore.allDataContainer[device];
            console.log(userDevices[device]);
            if(userDevices[device].userId !== undefined && userDevices[device].userId[0] in dataStore.userDataContainer){
                userDevices[device].user = dataStore.userDataContainer[userDevices[device].userId[0]];
            }
        } else {
            thermomiters[device] = dataStore.allDataContainer[device];
        }
    }

    var populate = {'userDevices':userDevices,
                    'thermomiters':thermomiters,
                    'users':dataStore.userDataContainer};
    main.innerHTML = displayConfigureTemplate(populate);
    console.log(populate);
    console.log(dataStore.userDataContainer);
};

var displayEmpty = function () {
    var main = document.getElementsByTagName("main")[0];
    main.innerHTML = 'content missing';
};

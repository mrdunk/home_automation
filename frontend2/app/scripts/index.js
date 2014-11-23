var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';

var tempSensorList = ['00000536d60c', '0000053610c1'];

var userInfoTemplate = Handlebars.compile(loadTemplate("userInfo.template"));
var teperaturesTemplate = Handlebars.compile(loadTemplate("teperatures.template"));
var userBriefTemplate = Handlebars.compile(loadTemplate("userBrief.template"));

var dataStore = new DataStore();

var thermometerSvg;
d3.xml("thermometer.svg", "image/svg+xml", function(xml) {
    thermometerSvg = document.importNode(xml.documentElement, true);
    console.log(thermometerSvg.getElementById("tempValue"));
    console.log(thermometerSvg.getElementById("tempValue").innerHTML);
    console.log(thermometerSvg.getElementById("tempValue").getElementsByTagName("tspan")[0].innerHTML = "10°C");

    //document.body.appendChild(thermometerSvg);
});

d3.ns.prefix.inkscape = "http://www.inkscape.org/namespaces/inkscape";


window.onload = function () {
    'use strict';
    console.log('window.onload');
    location.hash = 'startup';

    var main = d3.select("main");
    main.style("background-color", "white");

    main.transition()
        .duration(2000)
        .style("background-color", "lightgrey");


    verticalSwitchInit();
};

window.onhashchange = function () {
    'use strict';
    console.log(location.hash);
};



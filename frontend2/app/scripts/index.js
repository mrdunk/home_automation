var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';

var tempSensorList = ['00000536d60c', '0000053610c1'];


var dataStore = new DataStore();

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
    //whoshome();
    //whoshome2();
};

window.onhashchange = function () {
    'use strict';
    console.log(location.hash);
};



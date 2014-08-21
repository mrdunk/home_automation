var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';
var serverFQDN = serverFQDN1;

//var serverCubeMetricPort = '1081';
//var serverCubeCollectorPort = '1080';
var serverCubeMetricPort1 = '80';
var serverCubeCollectorPort1 = '80';
var serverCubeMetricPort2 = '8080';
var serverCubeCollectorPort2 = '8080';
var serverCubeMetricPort = serverCubeMetricPort1;
var serverCubeCollectorPort = serverCubeCollectorPort1;



var tempSensorList = ['00000536d60c', '0000053610c1'];


var useWebSocket = true;
//var useWebSocket = false;
var nwConnection = new Connection(useWebSocket);

window.onload = function () {
    'use strict';
    log('window.onload');
    log(location.hash, 'hash');
    authKey = getAuthKey();

};

window.onhashchange = function () {
    'use strict';
    console.log(location.hash);

    window.clearInterval(dataUpdateInterval);
    window.clearInterval(graphUpdateInterval);
    nwConnection.clearRepeatTimers();

    if(location.hash === '#control'){
        pageDials();
    } else if(location.hash === '#config'){
        new PageConfig();
    } else if(location.hash === '#graphs'){
        new PageGraphs();
    } else if(location.hash.indexOf('key=') === 1){
        authKey = getAuthKey();
    }
};


/* Rather than use the regular nwConnection to pull data from the server we opt to do a blocking wget.
 * This is because it would be pointless to do any other network related operations befroe we have the
 * required autherisation.  */
var getAuthKey = function(){
    'use strict';
    log('Not logged in.', 'Auth');
    // See if key has been sent as POST.
    if(location.hash.indexOf('key=') === 1){
        log(location.hash.substr(5), 'Auth');
        return location.hash.substr(5);
    }

    // Otherwise, get key from server.
    var returnedData;
    var url = '/authKey/';
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() { //Call a function when the state changes.
        console.log(request.readyState, request.status);
        if(request.readyState === 4 && request.status === 200) {
            console.log(request.responseText);
            returnedData = request.responseText;
            returnedData = JSON.parse(returnedData);
        }
    };
    var async = false;
    var method = 'GET';
    request.open(method, url, async);

    // Nasty way round the fact that AppEngine server will cause re-direct if user not logged in.
    try{
        request.send(null);
    }catch(err){
        console.log(err);
        returnedData = {loginStatus: false,
                url: '/logIn/'};
    }

    if(returnedData.loginStatus === true){
        log(returnedData.key, 'Auth');
        return returnedData.key;
    }

    window.location = returnedData.url;
};


var logDict = {};
var log = function(text, key, clear){
    'use strict';
        var logDiv = document.getElementById('log');
        if (typeof key === 'undefined'){
                key = 'freeform';
        }
        if (typeof clear === 'undefined'){
                clear = true;
        }

        logDict[key] = String(text);
        for (var k in logDict){

                var keyDiv = document.getElementById('log_' + k);
                if (keyDiv === null){
                        keyDiv = document.createElement('div');
                        keyDiv.id = 'log_' + k;
                        keyDiv.className = k;
                        logDiv.appendChild(keyDiv);
                }

                keyDiv.innerHTML = '<div style="border-width:1px;border-style:solid;background-color:#EEEEEE;width:20%;clear:both;float:left;">' + k +
                                   '</div><div style="border-width:1px;border-style:solid;background-color:#EEEEEE;width:80%;float:left;">' + logDict[k] + '</div>';
        }
};


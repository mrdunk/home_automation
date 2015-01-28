/* exported AuthKey */
/* global WS */
/* global HTTP */
/* global Network */

var serverFQDN1 = '192.168.192.254';
var serverFQDN2 = 'peeping.toythieves.com';
var appEngineFQDN = 'home-automation-7.appspot.com';

var AuthKey = '3160C01CF683B175FCBB9C7F04B97794';

window.onload = function () {
    'use strict';
    console.log('window.onload');

    //var output = document.getElementById('output');

    /*var websocketObject = new WS();
    websocketObject.registerQuery('/data?type=sensors&data={"label":"net_clients"}&age=300', 
            serverFQDN1, '55556');
    websocketObject.registerQuery('/data?type=sensors&data={"label":"net_clients"}&age=300', 
            serverFQDN2, '55556');
    websocketObject.registerQuery('/data?type=output', serverFQDN1, '55557');
    websocketObject.registerQuery('/data?type=output', serverFQDN2, '55557');

    for(var i in [1,2,3,4]){
        console.log(i);
        if(i%2){
            window.setTimeout(
                function(){websocketObject.get('/data?type=sensors&data={"label":"net_clients"}&age=300');}, i * 10000
            );
        } else {
            window.setTimeout(
                function(){websocketObject.get('/data?type=output');}, i * 10000
            );
        }
    }*/


    /*var httpObject = new HTTP();
    httpObject.registerQuery('/data?type=sensors&data={"label":"net_clients"}&age=300', 
                        serverFQDN1, '55555');
    httpObject.registerQuery('/data?type=sensors&data={"label":"net_clients"}&age=300', 
                        serverFQDN2, '55555');
    httpObject.registerQuery('/data?type=output', serverFQDN1, '55555');
    httpObject.registerQuery('/data?type=output', serverFQDN2, '55555');

    for(var i in [1,2,3,4,5,6]){
        console.log(i);
        window.setTimeout(
                function(){httpObject.getFromList('/data?type=sensors&data={"label":"net_clients"}&age=300');}, i * 10000);
    }*/

    var networkObject = new Network();
    networkObject.registerQuery('/data?type=sensors&data={"label":"net_clients"}&age=300', serverFQDN1, '55555', false);
    networkObject.registerQuery('/data?type=sensors&data={"label":"net_clients"}&age=300', serverFQDN2, '55555', false);
    networkObject.registerQuery('/data?type=output', serverFQDN1, '55557', true);
    networkObject.registerQuery('/data?type=output', serverFQDN2, '55557', true);
    networkObject.registerQuery('/listUsers/?', appEngineFQDN, '80', false);

    /*for(var i in [1,2,3,4]){
        console.log(i);
        if(i%2){
            window.setTimeout(
                    function(){networkObject.get('/data?type=sensors&data={"label":"net_clients"}&age=300');}, i * 10000
                    );
        } else {
            window.setTimeout(
                    function(){networkObject.get('/data?type=output');}, i * 10000
                    );
        }   
    }*/

    //networkObject.setQueryInterval('/data?type=output', 10000);
    networkObject.setQueryInterval('/listUsers/?', 10000);
    
};

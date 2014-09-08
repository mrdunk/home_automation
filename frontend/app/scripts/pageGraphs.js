function PageGraphs(){
    'use strict';
    console.log('Graphs');

    this.userData = new UserData(this.updateCallback.bind(this));
}

PageGraphs.prototype.updateCallback = function(){
    document.getElementById('people').innerHTML = "";
    for(var key in this.userData.deviceList){
        console.log(key, this.userData.deviceList[key], this.userData.deviceList[key].userUrl);
        var newElement = document.createElement('img');
        newElement.src = this.userData.deviceList[key].userUrl;
        document.getElementById('people').appendChild(newElement);
    }
};

PageGraphs.prototype.consumeData = function(data){
    console.log(data);
};

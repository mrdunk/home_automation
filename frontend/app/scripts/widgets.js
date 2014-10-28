function WhosHome(){
    'use strict';
    this.userData = new UserData(this.updateCallback.bind(this));

    this.lookupInProgress = false;

    // Repeat every 5 minutes.
    this.timer = setInterval(this.lookup.bind(this), 1 * 60 * 1000);
}

WhosHome.prototype.clearCache = function(){
    'use strict';
    this.userData.deviceList = {};
    this.userData.userList = false;
    console.log('clearCache', this.userData);
};

WhosHome.prototype.lookup = function(){
    'use strict';
    console.log('WhosHome.lookup');
    this.lookupInProgress = true;
    this.userData.getData();
};

WhosHome.prototype.updateCallback = function(){
    'use strict';
    //console.log('WhosHome.updateCallback');
    this.lookupInProgress = false;

    // Clear container.
    document.getElementById('people').innerHTML = "";

    var alreadyDone = [];
    for(var key in this.userData.deviceList){
        if(this.userData.deviceList[key].userId !== "none" && 
                this.userData.deviceList[key].userId !== "" &&
                alreadyDone.indexOf(this.userData.deviceList[key].userId) === -1){
            //console.log("*", key, this.userData.deviceList[key], this.userData.deviceList[key].userUrl);
            var newElement = document.createElement('img');
            newElement.src = this.userData.deviceList[key].userUrl;
            document.getElementById('people').appendChild(newElement);
            alreadyDone.push(this.userData.deviceList[key].userId);
        }
    }
    //console.log(alreadyDone);
};


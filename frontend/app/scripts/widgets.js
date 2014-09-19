function WhosHome(){
    'use strict';
    this.userData = new UserData(this.updateCallback.bind(this));

    // Repeat every 5 minutes.
    this.timer = setInterval(this.lookup.bind(this), 1 * 60 * 1000);
    this.lookupInProgress = false;
}

WhosHome.prototype.clearCache = function(){
    'use strict';
    this.userData.deviceList = {};
    this.userData.userList = {};
};

WhosHome.prototype.lookup = function(){
    'use strict';
    console.log('WhosHome.lookup');
    this.lookupInProgress = true;
    this.userData.getData();
};

WhosHome.prototype.updateCallback = function(){
    'use strict';
    console.log('WhosHome.updateCallback');
    this.lookupInProgress = false;

    // Clear container.
    document.getElementById('people').innerHTML = "";

    for(var key in this.userData.deviceList){
        console.log(key, this.userData.deviceList[key], this.userData.deviceList[key].userUrl);
        var newElement = document.createElement('img');
        newElement.src = this.userData.deviceList[key].userUrl;
        document.getElementById('people').appendChild(newElement);
    }
};


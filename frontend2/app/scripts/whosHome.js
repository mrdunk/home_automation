/* global dataStore */
/* global xtag */
/* global userInfoTemplate2 */

(function(xtag) {
    'use strict';
    xtag.register('x-whosHome', {
        lifecycle: {
            created: function created(){
                this.update(true);
            }
        },
        accessors: {
            updated: {
                set: function set(value){
                    //console.log('set', value);
                    this.setAttribute('updated', value);
                    this.update(true);
                }
            }
        },
        methods: {
            update: function update(displayIfOut){
                this.garbageCollectUsers(displayIfOut);
                this.displayUsers(displayIfOut);
            },
            createUser: function createUser(userId, displayIfOut){
                if(!dataStore.userDataContainer || !dataStore.userDataContainer[userId]){
                    // Data not loaded yet.
                    return;
                }
                if(!dataStore.userDataContainer[userId].home && !displayIfOut){
                    // User not in house.
                    return;
                }

                var data = { 'key': userId,
                             'value': dataStore.userDataContainer[userId] };

                var userInfo = document.createElement('div');
                userInfo.innerHTML = userInfoTemplate2(data);
                userInfo.id = 'whosHome-' + userId;
                userInfo.classList.add('whosHome');

                this.minimize(userInfo);
                userInfo.onclick=function(){
                    if(userInfo.classList.contains('maximized')){
                        userInfo.classList.remove('maximized');
                        this.minimize(userInfo);
                    } else {
                        userInfo.classList.add('maximized');
                        this.maximize(userInfo);
                    }
                    
                }.bind(this);

                this.appendChild(userInfo);
            },
            garbageCollectUsers: function garbageCollectUsers(displayIfOut){
                var usersHome = [];
                for(var userId in dataStore.userDataContainer){
                    if(dataStore.userDataContainer[userId].home || displayIfOut){
                        usersHome.push(userId);
                    }
                }
                for(var child in this.children){
                    if(this.children[child].id && this.children[child].id.split('-').length > 1){
                        var childId = this.children[child].id.split('-')[1];
                        if(usersHome.indexOf(childId) < 0){
                            // user not at home so hide it.
                            if(this.children[child].style){
                                this.children[child].style.display = "none";
                            }
                        }
                    }
                }
            },
            displayUsers: function displayUsers(displayIfOut){
                var usersHome = [];
                for(var userId in dataStore.userDataContainer){
                    if(dataStore.userDataContainer[userId].home || displayIfOut){
                        usersHome.push(userId);
                    }
                }
                for(var child in this.children){
                    if(this.children[child].id && this.children[child].id.split('-').length > 1){
                        var childId = this.children[child].id.split('-')[1];
                        var index = usersHome.indexOf(childId);
                        if(index >= 0){
                            // found an existing matching user element so remove it from the list of things to do,
                            usersHome.splice(index, 1);

                            // and update it.
                            var maximized = false;
                            if(this.children[child].classList.contains('maximized')){
                                maximized = true;
                            }
                            var data = { 'key': childId,
                                         'value': dataStore.userDataContainer[childId] };
                            this.children[child].innerHTML = userInfoTemplate2(data);
                            if(maximized){
                                this.children[child].classList.add('maximized');
                                this.maximize(this.children[child]);
                            } else {
                                this.minimize(this.children[child]);
                            }
                        }
                    }
                }
                for(userId in usersHome){
                    this.createUser(usersHome[userId], displayIfOut);
                }
            },
            maximize: function maximize(element){
                for(var child in element.children){
                    if(element.children[child].classList && element.children[child].classList.contains('hideWhenMaximized')){
                        element.children[child].classList.remove('displayVisible');
                        element.children[child].classList.add('displayNone');
                    } else if(element.children[child].classList && element.children[child].classList.contains('hideWhenMinimized')){
                        element.children[child].classList.remove('displayNone');
                        element.children[child].classList.add('displayVisible');
                    }
                }
            },
            minimize: function minimize(element){
                for(var child in element.children){
                    if(element.children[child].classList && element.children[child].classList.contains('hideWhenMinimized')){
                        element.children[child].classList.remove('displayVisible');
                        element.children[child].classList.add('displayNone');
                    } else if(element.children[child].classList && element.children[child].classList.contains('hideWhenMaximized')){
                        element.children[child].classList.remove('displayNone');
                        element.children[child].classList.add('displayVisible');
                    }
                }
            }
        }
    });
})(xtag);

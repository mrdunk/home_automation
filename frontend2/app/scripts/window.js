/* global xtag */
var MINIMIZEDSIZE = '1.2em';
(function(xtag) {
    'use strict';
    xtag.register('x-window', {
        lifecycle: {
            created: function(){
                this.className = "window window-transition_pos";
                this.resize('200px', '200px');
                this.position(100, 100);

                xtag.innerHTML(this, 
                    '<x-window-header>' +
                      '<x-window-button class="maxMin"></x-window-button>' + 
                      '<x-window-button class="other"></x-window-button>' + 
                    '</x-window-header');
            }
        },
        events: {
            'cick:delegate(x-window-header)': function(event){
                console.log('click:delegate(x-window-header)');
            },
            'dragstart:delegate(x-window-header)': function(event){
                console.log('dragstart:delegate(x-window-header)', event.x, event.y);
                this.lastDragX = event.x;
                this.lastDragY = event.y;
            },
            'drag:delegate(x-window-header)': function(event){
                //console.log('drag:delegate(x-window-header)', event.x - this.startDragX, event.y - this.startDragY);
                if(!event.x && !event.y){
                    // On dragend tis gets triggered with event.x === 0 and event.y === 0.
                    return;
                }

                var x = event.x - this.lastDragX;
                var y = event.y - this.lastDragY;

                var target = this;
                while(target){
                    if(target.rePosition){
                        target.rePosition(x, y);
                        break;
                    }
                    target = target.parentNode;
                }
                
                this.lastDragX = event.x;
                this.lastDragY = event.y;
            },
            'click:delegate(x-window-button.maxMin)': function(event){
                console.log('click:delegate(div.window-header)');

                var target = this;
                while(target){
                    if(target.maxMin){
                        target.maxMin();
                        break;
                    }
                    target = target.parentNode;
                }
            }
        },
        methods: {
            resize: function(x, y){
                this.style.width = x;
                this.style.height = y;
                this.sizex = x;
                this.sizey = y;
            },
            position: function(x, y){
                this.x = x;
                this.y = y;
                this.style.left = x + 'px';
                this.style.top = y + 'px';
            },
            rePosition: function(x, y){
                this.x += x;
                this.y += y;
                if(!this.rePositionTimer){
                    this.rePositionTimer = true;
                    window.setTimeout(function(){
                        this.rePositionTimer = false;
                        this.style.left = this.x + 'px';
                        this.style.top = this.y + 'px';
                    }.bind(this), 100);
                }
            },
            minimize: function(){
                this.style.width = MINIMIZEDSIZE;
                this.style.height = MINIMIZEDSIZE;
            },
            normalsize: function(){
                this.style.width = this.sizex;
                this.style.height = this.sizey;
            },
            maxMin: function(){
                this.className = "window window-transition_long";
                if(this.style.width === this.sizex && this.style.height === this.sizey){
                    this.style.left = '10px';
                    this.style.top = '10px';
                    this.minimize();
                } else {
                    this.position(this.x, this.y);
                    this.normalsize();
                }
                this.className = "window window-transition_pos";
            }
        },
    });
    xtag.register('x-window-header', {
        lifecycle: {
            created: function(){
                this.className = 'window-header';
                this.setAttribute('draggable', 'true');

                this.style.left = '0';
                this.style.top = '0';
            }
        },
        events: {
        },
        methods: {
        }
    });
    xtag.register('x-window-button', {
        lifecycle: {
            created: function(){
                this.className += ' window-button';
            }
        },
        events: {
        }
    });
})(xtag);

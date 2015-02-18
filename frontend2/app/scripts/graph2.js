/* global dataStore */
/* global xtag */
/* global c3 */

/* exported updateGraphs */

function minsToDay(time){
    'use strict';
    if(time < 1440){
        return 'Sun';
    } else if(time < 2 * 1440){
        return 'Mon';
    } else if(time < 3 * 1440){
        return 'Tue';
    } else if(time < 4 * 1440){
        return 'Wed';
    } else if(time < 5 * 1440){
        return 'Thu';
    } else if(time < 6 * 1440){
        return 'Fri';
    }
    return 'Sat';
}

/*function dayToMins(time){
    'use strict';
    if(!time || time.split(' ').length === 1){
        return;
    }
    var day = time.split(' ')[0];
    var hour = parseInt(time.split(' ')[1].split(':')[0]);

    var minuteTotal = 0;
    if(day === 'Mon'){
        minuteTotal += 1440;
    } else if(day === 'Tue'){
        minuteTotal += 2 * 1440;
    } else if(day === 'Wed'){
        minuteTotal += 3 * 1440;
    } else if(day === 'Thu'){
        minuteTotal += 4 * 1440;
    } else if(day === 'Fri'){
        minuteTotal += 5 * 1440;
    } else if(day === 'Sat'){
        minuteTotal += 6 * 1440;
    }
    minuteTotal += 60 * hour;
    console.log(day, hour, minuteTotal, minsToDay(minuteTotal));

    return minuteTotal;
}*/

function minsToTime(time){
    'use strict';
    var minutesInWeek = 60 * 24 * 7;
    time %= minutesInWeek;
    if(time < 0){
        time += minutesInWeek;
    }

    var day = minsToDay(time);
    var hour = parseInt((time / 60) % 24);
    hour = hour > 9 ? "" + hour: "0" + hour;
    var minute = (time % 60).toFixed(0);
    minute = minute > 9 ? "" + minute: "0" + minute;

    return day + " " + hour + ":" + minute;
}

(function(xtag) {
    'use strict';
    var MinutesInWeek = 60 * 24 * 7;

    xtag.register('x-graph2', {
        lifecycle: {
            created: function(){
                // Delay all these so they don't overlap other network events too much.
                this.loadData();

                this.average_temp = [];
                this.temp_setting = [];
                this.heating_state = [];
                this.labels = [];
                this.xKey = [];
                window.setTimeout(function(){this.updateData();}.bind(this), 500);
            }
        },
        accessors: {
            updated: {
                set: function(value){
                    //console.log('set', value);
                    this.setAttribute('updated', value);
                    this.updateData();
                }
            }
        },
        methods: {
            loadData: function loadData(){
                // Delay all these so they don't overlap other network events too much.
                if(this.loadingdata){
                    return;
                }
                this.loadingdata = true;
                window.setTimeout(function(){dataStore.network.get('/cyclicDB_average_temp_1_week?');}, 100);
                window.setTimeout(function(){dataStore.network.get('/cyclicDB_temp_setting_1_week?');}, 200);
                window.setTimeout(function(){dataStore.network.get('/cyclicDB_heating_state_1_week?');}, 300);
                window.setTimeout(function(){dataStore.network.get('/serverTime?');}, 400);
                window.setTimeout(function(){delete this.loadingdata;}.bind(this), 500);
            },
            addPoint: function addPoint(index){
                if(index % 15 === 0){
                    if(index < 0){
                        index += MinutesInWeek;
                    }
                    index %= MinutesInWeek;
                    //console.log('addPoint(', index, ')', 
                    //            +parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][index]).toFixed(2));
                    if(this.xKey.length >= MinutesInWeek / 15){
                        this.xKey.shift();
                        this.average_temp.shift();
                        this.temp_setting.shift();
                        this.heating_state.shift();
                    }
                    
                    if(!index){
                        this.xKey.push(MinutesInWeek);  // C3js doesn't seem to like "0" keys.
                    } else {
                        this.xKey.push(index);
                    }
                    this.average_temp.push(+parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][index]).toFixed(2));
                    this.temp_setting.push(+parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][index]).toFixed(2));
                    this.heating_state.push(+parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][index]).toFixed(2));

                    if(minsToTime(index).match(/00:00/g)){
                        var l = (this.xKey.length -1) % 48;
                        while(l < this.xKey.length){
                            //if(this.labels.indexOf(l) === -1){
                            //    this.labels.push(l);
                            //}
                            this.labels.push(l);
                            if(this.labels.length > 14){
                                this.labels.shift();
                            }
                            l += 48;
                        }
//                        this.labels.push(this.xKey.length -1);
                        console.log(this.labels);
                    }
                }
            },
            draw: function draw(){
                console.log("draw()", this.xKey, this.xKey.length, this.average_temp.length, this.xKey[0], this.average_temp[0], this.xKey[1], this.average_temp[1]);
                console.log(this.xKey[this.xKey.length -1], this.average_temp[this.average_temp.length -1]);
                this.chart.load({
                    //unload: true,
                    x: 'x',
                    columns: [
                        ['x'].concat(this.xKey),
                        ['temp_setting'].concat(this.temp_setting),
                        ['average_temp'].concat(this.average_temp),
                        ['heating_state'].concat(this.heating_state)
                    ]});
            },
            updateData: function updateData(){
                if(!dataStore.allDataContainer.time || !dataStore.allDataContainer.temp_setting_1_week ||
                        !dataStore.allDataContainer.average_temp_1_week || !dataStore.allDataContainer.heating_state_1_week){
                    // Data not read yet.
                    this.loadData();
                    return;
                }

                if(Date.now() - dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[1] > 5 * 60 * 1000 ||
                        Date.now() - dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[1] > 5 * 60 * 1000 ||
                        Date.now() - dataStore.allDataContainer.heating_state_1_week.heating_state_1_week > 5 * 60 * 1000 ){
                    // Data more than 5 minutes old. Let's not do any of this now. Wait for new data to arrive instead.
                    // This is necesary to make sure we don't display stale data after a client has been suspended.
                    this.loadData();
                    return;
                }


                if(!this.chart){
                    this.initialise();
                }
                
                var minutesIntoWeekInt = dataStore.allDataContainer.time.time[0];
                minutesIntoWeekInt -= minutesIntoWeekInt % 15;

                console.log(this.lastKey, minutesIntoWeekInt);
                this.lastKey %= MinutesInWeek;

                var updated = false;
                while(this.lastKey +15 < minutesIntoWeekInt){
                    this.addPoint(this.lastKey);
                    this.lastKey += 15;
                    updated = true;
                }
                if(updated){
                    this.draw();
                }
            },
            populateData: function populateData(){
                var minsIntoWeekInt = dataStore.allDataContainer.time.time[0];
                minsIntoWeekInt -= minsIntoWeekInt % 15;

                this.lastKey = minsIntoWeekInt - MinutesInWeek;
                return;
            },
            clickGraph: function clickGraph(dataPoint, element){
                if(dataPoint.id !== 'average_temp'){
                    // Only do this for one of the datasets. (This function will trigger for them all.)
                    return;
                }
                if(this.chart.recentClick){
                    this.chart.recentClick = false;
                    this.chart.zoom([1, 670]);
                    return;
                }
                this.chart.recentClick = true;
                window.setTimeout(function(){this.chart.recentClick = false;}.bind(this), 500);
                this.chart.zoom([dataPoint.x -100, dataPoint.x +100]);
            },
            initialise: function initialise(){
                this.innerHTML = '<div id="chart"></div>';
                this.populateData();
                this.chart = c3.generate({
                    padding: {right: 20},
                    //interaction: {enabled: false},
                    transition: {duration: 0},
                    tooltip:{
                        position: function (data, width, height, element) {
                            var chartOffsetX = document.querySelector("#chart").getBoundingClientRect().left;
                            var graphOffsetX = document.querySelector("#chart g.c3-axis-y").getBoundingClientRect().right;
                            var tooltipWidth = document.querySelector('.c3-tooltip').parentNode.clientWidth;
                            var x = parseInt(element.getAttribute('x')) + graphOffsetX - chartOffsetX - Math.floor(tooltipWidth/2);
                            if(window.innerWidth - tooltipWidth < x){
                                x = window.innerWidth - tooltipWidth;
                            }
                            if(x < 0){
                                x = 0;
                            }
                            var y = 0;
                            return {top: y, left: x};
                        }
                    },
                    grid: {
                        y: {show: true}
                    },
                    bindto: '#chart',
                    data: {
                        x: 'x',
                        columns: [
                            ['x'].concat(this.xKey),
                            ['temp_setting'].concat(this.temp_setting),
                            ['average_temp'].concat(this.average_temp),
                            ['heating_state'].concat(this.heating_state)
                          ],
                        type: 'line',
                        types: {heating_state: 'area-step'},
                        axes: {heating_state: 'y2'},
                        selection: {grouped: true},
                        onclick: this.clickGraph.bind(this),
                        //onmouseover: function (d) {if(d.id === 'average_temp'){console.log(d, d.x, this.xKey[d.x]);}}.bind(this)
                    },
                    //zoom: {enabled: true},
                    legend: {hide: 'heating_state'},
                    point: {show: false},
                    bar: {
                        width: {ratio: 1}
                    },
                    axis : {
                        x : {
                            type: 'category',
                            tick: {
                                multiline: false,
                                format: function(x){return minsToTime(this.xKey[Math.round(x)]); }.bind(this),
                                values: this.labels,
                            }
                        },
                        y: {
                            //max: 23,
                            min: 10
                        },
                        y2: {
                            max: 1,
                            min: 0
                        }
                    },
                    color: {
                        pattern: ["rgba(95,180,4,1)", "rgba(223,1,1,1)", "rgba(255,200,200,0.6)"]
                    }
                });
            }
        }
    });
})(xtag);


function updateGraphs(){
    'use strict';
    //console.log('updateGraphs()');
    document.getElementById('graph2').updated = true;
}

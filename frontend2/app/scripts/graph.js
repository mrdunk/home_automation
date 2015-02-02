/* global dataStore */
/* global xtag */
/* global Chart */

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

function dayToMins(time){
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
}

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
    var GRAPHHEIGHT = 400;
    var GRAPHWIDTH = 2013;
    var MinutesInWeek = 60 * 24 * 7;

    xtag.register('x-graph', {
        lifecycle: {
            created: function(){
                dataStore.network.get('/cyclicDB_average_temp_1_week?');
                dataStore.network.get('/cyclicDB_temp_setting_1_week?');
                dataStore.network.get('/cyclicDB_heating_state_1_week?');
                dataStore.network.get('/serverTime?');

                this.draw();
            }
        },
        accessors: {
            updated: {
                // For some reason, setting .updated results in a 
                // "Uncaught TypeError: Cannot assign to read only property 'updated'" error
                // We can achieve the same thing by just reading this value.
                get: function(){
                    //console.log('get');
                    this.draw();
                },
                set: function(value){
                    //console.log('set', value);
                    this.setAttribute('updated', value);
                    this.draw();
                }
            }
        },
        methods: {
            addPoint: function addPoint(index){
                if(index % 60 === 0){
                    var temperatureSetPoint = 0;
                    
                    var indexM3 = index -30;
                    var indexM2 = index -30;
                    var indexM1 = index -15;
                    if(indexM3 < 0){
                        indexM3 += MinutesInWeek;
                    }
                    if(indexM2 < 0){
                        indexM2 += MinutesInWeek;
                    }
                    if(indexM1 < 0){
                        indexM1 += MinutesInWeek;
                    }

                    var m3, m2, m1, m0;

                    if(dataStore.allDataContainer.temp_setting_1_week){
                        m3 = parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][indexM3]);
                        m2 = parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][indexM2]);
                        m1 = parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][indexM1]);
                        m0 = parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][index]);

                        temperatureSetPoint = (m3 + m2 + m1 + m0) / (Boolean(m3) + Boolean(m2) + Boolean(m1) + Boolean(m0));                        
                    }

                    var temperatureAverage = 0;
                    if(dataStore.allDataContainer.average_temp_1_week){
                        m3 = parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][indexM3]);
                        m2 = parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][indexM2]);
                        m1 = parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][indexM1]);
                        m0 = parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][index]);

                        temperatureAverage = (m3 + m2 + m1 + m0) / (Boolean(m3) + Boolean(m2) + Boolean(m1) + Boolean(m0));
                    }

                    var heatingState = 0;
                    if(dataStore.allDataContainer.heating_state_1_week){
                        heatingState = parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][indexM3]);
                        heatingState |= parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][indexM2]);
                        heatingState |= parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][indexM1]);
                        heatingState |= parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][index]);
                    }
                    
                    // I have updated Chart.js to not re-fresh the image on every .addData() when the 3rd peramiter === true.
                    this.myLineChart.addData([temperatureSetPoint, temperatureAverage], minsToTime(index), true);
                    this.myLineChart2.addData([heatingState], minsToTime(index), true);
                }
            },
            /* Initialy populate graph. */
            bootstrapData: function bootstrapData(){
                this.lastUpdated = Date.now();
                var currentTimeInt = dataStore.allDataContainer.time.time[0];
                currentTimeInt -= currentTimeInt % 60;

                while(this.myLineChart.datasets[0].points.length){
                    this.myLineChart.removeData();
                }
                while(this.myLineChart2.datasets[0].points.length){
                    this.myLineChart2.removeData();
                }

                for(var itterator = currentTimeInt + 60; itterator <= currentTimeInt + MinutesInWeek; 
                            itterator += 60){
                    var adjustedItterator = itterator;
                    if(adjustedItterator >= MinutesInWeek){
                        adjustedItterator -= MinutesInWeek;
                    }
                    this.addPoint(adjustedItterator);
                }
                this.myLineChart.update();
                this.myLineChart2.update();
            },
            updateData: function updateData(){
                var currentTimeInt = dataStore.allDataContainer.time.time[0];
                currentTimeInt -= currentTimeInt % 60;

                var oldestTimeInt = dayToMins(this.myLineChart.scale.xLabels[0]);
                var lastValidTimeInt = oldestTimeInt - 60;
                if(lastValidTimeInt < 0){
                    lastValidTimeInt += MinutesInWeek;
                }
                var timeGap = currentTimeInt - lastValidTimeInt;
                if(timeGap < 0){
                    timeGap += MinutesInWeek;
                }
                

                for(var itterator = lastValidTimeInt + 60; itterator <= lastValidTimeInt + timeGap; itterator += 60){
                    var adjustedItterator = itterator;
                    if(adjustedItterator >= MinutesInWeek){
                        adjustedItterator -= MinutesInWeek;
                    }
                    this.myLineChart.removeData();
                    this.myLineChart2.removeData();
                    this.addPoint(adjustedItterator);
                }
                this.myLineChart.update();
                this.myLineChart2.update();
            },
            draw: function draw(){
                if(!dataStore.allDataContainer.time){
                    // Data not read yet.
                    return;
                }
                if(this.myLineChart){
                    // TODO update existing.
                    console.log('drawnAlready');

                    // Update not more than every 10 minutes.
                    if(!this.lastUpdated || Date.now() > this.lastUpdated + (1*60*1000)){
                        console.log('updating', Date.now() - this.lastUpdated);
                        this.lastUpdated = Date.now();
                        window.setTimeout(this.updateData.bind(this), 1000);
                        //this.updateData();
                    }
                    return;
                }
                if(!document.getElementsByTagName('x-graph').length || !dataStore.allDataContainer.temp_setting_1_week ||
                        !dataStore.allDataContainer.average_temp_1_week || !dataStore.allDataContainer.heating_state_1_week){
                    console.log('data not received yet');
                    return;
                }
                console.log('**** not drawnAlready', this.drawnAlready);

                var options = {
                    scaleShowLabels: false,
                    animation: false,
                    showTooltips: false,
                    pointHitDetectionRadius : 2,
                    pointDot : false,
                    datasetFill : false,
                    //bezierCurve :false,
                    bezierCurveTension : 0.2,
                };

                var options2 = {
                    scaleShowLabels: false,
                    showTooltips: false,
                    animation: false,
                    pointDot : false,
                    bezierCurve :false,
                    datasetStroke : false,
                    datasetFill : true,
                };

                var data = {
                        labels: ['placeholder', 'placeholder2'],
                        datasets: [
                                    {
                                        label: "Set point",
                                        strokeColor: "rgba(180,95,4,1)",
                                        pointColor: "rgba(180,95,4,1)",
                                        data: [1,2]
                                    },
                                    {
                                        label: "Actual",
                                        strokeColor: "rgba(223,1,1,1)",
                                        pointColor: "rgba(223,1,1,1)",
                                        data: [3,4]
                                    }
                                ]
                };
                var data2 = {
                        labels: ['placeholder', 'placeholder2'],
                        datasets: [
                                    {
                                        label: "Haeting on/off",
                                        fillColor: "rgba(255,110,110,0.4)",
                                        strokeColor: "rgba(110,110,255,0)",
                                        pointColor: "rgba(110,110,255,1)",
                                        data: [0.1, 0.2]
                                    }
                        ]
                };

                this.innerHTML = '<canvas id="heatingStateGraph" width="' + GRAPHWIDTH + '" height="' + GRAPHHEIGHT + '" class="graph"></canvas>' +
                                 '<canvas id="temperatureGraph" width="' + GRAPHWIDTH + '" height="' + GRAPHHEIGHT + '" class="graph"></canvas>' +
                                 '<div id="graphToolTipLine" class="graphToolTipLine"></div>' +
                                 '<div id="graphToolTipBox" class="graphToolTipBox graphToolTipBoxRight"></div>';

                var canvasTop = document.getElementById("temperatureGraph");
                var ctxTop = canvasTop.getContext("2d");
                var ctxBottom = document.getElementById("heatingStateGraph").getContext("2d");
                
                this.myLineChart = new Chart(ctxTop).Line(data, options);
                this.myLineChart2 = new Chart(ctxBottom).Line(data2, options2);
                
                var toolTipLine = document.getElementById("graphToolTipLine");
                var toolTipBox = document.getElementById("graphToolTipBox");
                toolTipLine.style.height = "" + GRAPHHEIGHT + "px";
                toolTipBox.style.top = "" + GRAPHHEIGHT + "px";

                canvasTop.onmousemove = function tooltipMouseMove(evt){
                    var activePoints = this.myLineChart.getPointsAtEvent(evt);
                    if(activePoints[0]){
                        var x = activePoints[0].x;
                        var boxPos = x;
                        if(x > GRAPHWIDTH / 2){
                            toolTipBox.className = toolTipBox.className.replace('Right', 'Left');
                            boxPos = boxPos - toolTipBox.offsetWidth +2;
                        } else {
                            toolTipBox.className = toolTipBox.className.replace('Left', 'Right');
                        }
                        toolTipLine.style.left = "" + x + "px";
                        toolTipBox.style.left = "" + boxPos + "px";

                        toolTipBox.innerHTML = '<b>' + activePoints[0].label + '</b>';
                        for(var i in activePoints){
                            var fillCol = this.myLineChart.datasets[i].strokeColor;
                            var description = this.myLineChart.datasets[i].label;
                            var val = activePoints[i].value;
                            toolTipBox.innerHTML += '<br/><div class="graphLineLabel">' + description + '</div>';
                            toolTipBox.innerHTML += '<div class="graphLineIcon" style="background-color: ' + fillCol + ';"></div>';
                            toolTipBox.innerHTML += ' ' + (Math.round(val * 10)/10) + '°C';
                        }
                    }
                }.bind(this);

                this.bootstrapData();
            }
        }
    });
})(xtag);


function updateGraphs(){
    'use strict';
    //console.log('updateGraphs()');
    document.getElementById('graph').updated = true;
}

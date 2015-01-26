/* global dataStore */
/* global xtag */
/* global Chart */

/* exported UpdateGraphs */

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

function minsToTime(time){
    'use strict';
    var day = minsToDay(time);
    var hour = parseInt((time / 60) % 24);
    hour = hour > 9 ? "" + hour: "0" + hour;
    var minute = time % 60;
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
                dataStore.sendQueryNow("house", "/cyclicDB_average_temp_1_week?");
                dataStore.sendQueryNow("house", "/cyclicDB_temp_setting_1_week?");
                dataStore.sendQueryNow("house", "/cyclicDB_heating_state_1_week?");
                dataStore.sendQueryNow("house", "/serverTime?");

                this.draw();
            }
        },
        accessors: {
            updated: {
                // For some reason, setting .updated results in a 
                // "Uncaught TypeError: Cannot assign to read only property 'updated'" error
                // We can achieve the same thing by just reading this value.
                get: function(){
                    console.log('get');
                    this.draw();
                },
                set: function(value){
                    console.log('set', value);
                    this.setAttribute('updated', value);
                    this.draw();
                }
            }
        },
        methods: {
            addPoint: function addPoint(index){
                if(index % 60 === 0){
                    var temperatureSetPoint = 0;
                    
                    var indexM2 = index -30;
                    var indexM1 = index -15;
                    var indexP1 = index +15;
                    if(indexM2 < 0){
                        indexM2 += MinutesInWeek;
                    }
                    if(indexM1 < 0){
                        indexM1 += MinutesInWeek;
                    }
                    if(indexP1 >= MinutesInWeek){
                        indexP1 -= MinutesInWeek;
                    }


                    if(dataStore.allDataContainer.temp_setting_1_week){
                        temperatureSetPoint = parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][indexM2]);
                        temperatureSetPoint += parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][indexM1]);
                        temperatureSetPoint += parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][index]);
                        temperatureSetPoint += parseFloat(dataStore.allDataContainer.temp_setting_1_week.temp_setting_1_week[0][indexP1]);
                    }

                    var temperatureAverage = 0;
                    if(dataStore.allDataContainer.average_temp_1_week){
                        temperatureAverage = parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][indexM2]);
                        temperatureAverage += parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][indexM1]);
                        temperatureAverage += parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][index]);
                        temperatureAverage += parseFloat(dataStore.allDataContainer.average_temp_1_week.average_temp_1_week[0][indexP1]);
                    }

                    var heatingState = 0;
                    if(dataStore.allDataContainer.heating_state_1_week){
                        heatingState = parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][indexM2]);
                        heatingState |= parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][indexM1]);
                        heatingState |= parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][index]);
                        heatingState |= parseFloat(dataStore.allDataContainer.heating_state_1_week.heating_state_1_week[0][indexP1]);
                    }
                    
                    // I have updated Chart.js to not re-fresh the image on every .addData() ehrn yhe 3rd peramiter === true.
                    this.myLineChart.addData([(temperatureSetPoint / 4), (temperatureAverage / 4)], minsToTime(index), true);
                    this.myLineChart2.addData([heatingState], minsToTime(index), true);
                }
            },
            updateData: function updateData(){
                var timeInt = dataStore.allDataContainer.time.time[0];
                timeInt -= timeInt % 60;
                
                while(this.myLineChart.datasets[0].points.length){
                    this.myLineChart.removeData();
                }
                while(this.myLineChart2.datasets[0].points.length){
                    this.myLineChart2.removeData();
                }

                for(var itterator = timeInt + 60; itterator <= timeInt + MinutesInWeek; itterator += 60){
                    var adjustedItterator = itterator;
                    if(itterator >= MinutesInWeek){
                        adjustedItterator = itterator - MinutesInWeek;
                    }
                    this.addPoint(adjustedItterator);
                }
                this.myLineChart.update();
                this.myLineChart2.update();
            },
            draw: function draw(){
                if(this.myLineChart){
                    // TODO update existing.
                    console.log('drawnAlready');
                    return;
                }
                if(!document.getElementsByTagName('x-graph').length || !dataStore.allDataContainer.temp_setting_1_week ||
                        !dataStore.allDataContainer.average_temp_1_week || !dataStore.allDataContainer.heating_state_1_week){
                    console.log('data not received yet');
                    return;
                }
                if(this.myLineChart){
                    this.myLineChart.draw();
                    this.myLineChart2.draw();
                    console.log('redrawing');
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
                                 '<div id="graphToolTipBox" class="graphToolTipBox"></div>';

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

                        toolTipLine.style.left = "" + x + "px";
                        toolTipBox.style.left = "" + x + "px";

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

                this.updateData();
            }
        }
    });
})(xtag);


function UpdateGraphs(){
    'use strict';
    console.log('UpdateGraphs()');
    document.getElementById('graph').updated = true;
}


var controlSettings = {};

function verticalSwitchInit(){
    'use strict';

    var height = "44px";
    var width = "20px";
    var names = [];

    var changeColourGreen = function(switchId){
        d3.select(this).style({"background-color": "green", "border-color": "green"});
        d3.event.stopPropagation();
    };

    var changeColourGrey = function(switchId){
        d3.select(this).style({"background-color": "grey", "border-color": "grey"});
        d3.event.stopPropagation();
    };

    var toggleSwitch = function(switchId){
        console.log(switchId);
        if(typeof controlSettings[switchId] === "undefined" || controlSettings[switchId] === 0){
            controlSettings[switchId] = 1;
            d3.select("main").select("#" + switchId).select("#inner").style({"position": "relative", "top": "20px"});
        } else {
            controlSettings[switchId] = 0;
            d3.select("main").select("#" + switchId).select("#inner").style({"position": "relative", "top": "0px"});
        }
    };

    // The HTML that makes up a switch.
    var switchHtml = "<div id='footprint'><div id='outer'><div id='inner'></div></div></div>";

    var switches = d3.select("main").selectAll("verticalswitch");

    // Ugly hack to get id-s of all switches.
    switches.forEach(function(v,i,a){
                        v.forEach(function test(vv,ii,aa){
                                    names.push(vv.id);
                                  });
                     });

    switches.data(names)
        .html(switchHtml);

    switches.select("#footprint")
        .style({"width": width, "height": height, "padding": "1px"});

    switches.select("#outer")
        .style({"background-color": "grey", "width": "100%", "height": "100%", "border": "2px solid", "border-color": "grey", "border-radius": "4px"})
        .on("mouseover", changeColourGreen)
        .on("mouseout", changeColourGrey)
        .on("click", toggleSwitch)
        .select("#inner")
        .style({"background-color": "black", "width": "80%", "height": "40%", "border-radius": "4px", "margin-left": "auto", "margin-right": "auto"});

}

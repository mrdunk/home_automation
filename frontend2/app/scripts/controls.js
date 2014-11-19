
var controlSettings = {};

var FADETIME = 250;

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

function whoshome(){
    'use strict';
    var pictureHtml = '<span title="NAME"><img src="URL" width="60" height="60"></span>';
    var retval;

    var dataProcess = function(kv, index){
        if("displayName" in kv.value && "image" in kv.value){
            retval = pictureHtml.replace("NAME", kv.value.displayName).replace("URL", kv.value.image);
            return retval;
        }
        return "loading...";
    }

    var onClick = function(pictureId){
//        displayUser(pictureId.value);
        d3.select("main").select("#people").selectAll("div")
            .transition()
            .duration(FADETIME)
            .style("-webkit-transform", "scale(1)")
            .transition()
            .duration(FADETIME)
            .style("-webkit-transform", "scale(0)")
            .each("end", function(){displayUser(pictureId.value);});
    }

    // Remove all pre-existing so transitions work.
    d3.select("main").select("#people").selectAll("div").remove();

    var workspace = d3.select("main").select("#people").selectAll("div")
        .data(d3.entries(dataStore.userDataContainer));

    workspace.html(dataProcess)
        .attr("class", "whosHome")
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)");

    workspace.enter()
        .append("div")
        .html(dataProcess)
        .attr("class", "whosHome")
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)");

    workspace.transition()
        .style("-webkit-transform", "scale(0)")
        .transition()
        .duration(FADETIME)                                               
        .style("-webkit-transform", "scale(1)");

    workspace.exit()
        .remove();
    
//    var workspace = d3.select("main").select("#people").append("div").attr("class", "whosHomeFooter");
}

var displayUserHTML = '\
<dl class="displayUserTitle"> \
  <dt>User</dt> \
    <dd><img src="#image" width="60" height="60"></dd> \
    <dd>#displayName</dd> \
</dl> \
<dl class="displayUser"> \
  <dt>Device</dt> \
    #description \
</dl> \
<dl class="displayUser"> \
  <dt>IP-Address</dt> \
    #net_clients \
</dl> \
<dl class="displayUser"> \
  <dt>MAC-Address</dt> \
    #macAddr \
</dl> \
'

function displayUser(userData){
    'use strict';
    console.log("displayUser", userData);
    var retVal, i;
    var dispDescription = "";
    var dispNet_clients = "";
    var dispMAC_Address = "";

    var onClick = function(pictureId){
        // Click anywhere on the popup to restore view of all users.
        d3.select("main").select("#people").selectAll("div")
            .transition()
            .duration(FADETIME)
            .style("-webkit-transform", "scale(1)")
            .transition()
            .duration(FADETIME)
            .style("-webkit-transform", "scale(0)")
            .each("end", whoshome);
    }

    var dataProcess = function(kv, index){
        console.log(kv, index);
        retVal = displayUserHTML.replace("#image", kv.image);
        retVal = retVal.replace("#displayName", kv.displayName);

        // We presume that any valid device has a description.
        for(i in kv.description){
            dispDescription = dispDescription + "<dd>" + kv.description[i] + "</dd>";

            // Add "unknown" placeholder if data does not exist and then add to output to display.
            if(typeof kv.net_clients === "undefined"){ kv.net_clients = []; }
            if(typeof kv.net_clients[i] === "undefined"){ kv.net_clients[i] = "unknown"; }
            dispNet_clients = dispNet_clients + "<dd>" + kv.net_clients[i] + "</dd>";

            if(typeof kv.macAddr === "undefined"){ kv.macAddr = []; }
            if(typeof kv.macAddr[i] === "undefined"){ kv.macAddr[i] = "unknown"; }
            dispMAC_Address = dispMAC_Address + "<dd>" + kv.macAddr[i] + "</dd>";
        }
        retVal = retVal.replace("#description", dispDescription);
        retVal = retVal.replace("#net_clients", dispNet_clients);
        retVal = retVal.replace("#macAddr", dispMAC_Address);
        return retVal;
    }

    // Remove all pre-existing so transitions work.
    d3.select("main").select("#people").selectAll("div").remove();

    var workspace = d3.select("main").select("#people").selectAll("div").data([userData]);

    workspace.html(dataProcess)
        .attr("class", "displayUser")
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)");

    workspace.enter()
        .append("div")
        .attr("class", "displayUser")
        .html(dataProcess)
        .on("click", onClick)
        .style("-webkit-transform", "scale(0)");

    workspace.transition()
        .style("-webkit-transform", "scale(0)")
        .transition()
        .duration(FADETIME)
        .style("-webkit-transform", "scale(1)");

    workspace.exit()
        .remove();
}



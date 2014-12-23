// Functions for the "configure" page.

Handlebars.registerHelper('safeVal', function (value, safeValue) {
    var out = value || safeValue;
    return new Handlebars.SafeString(out);
});         

Handlebars.registerHelper('ifSelected', function(v1, v2){
    if(v1 === v2){
        return 'selected'; 
    }
    return '';
});

var onClickUserDevice = function(devId, action){
    console.log(devId);
    var main = document.getElementsByTagName("main")[0];
    var divs = main.getElementsByTagName('div');
    for(var d in divs){
        if(divs[d] !== undefined && divs[d].className !== undefined){
            var classes = divs[d].className.split(" ");
            for(var c in classes){
                if(classes[c] !== undefined){
                    if(devId === classes[c].substr(0, devId.length)){
                        console.log(classes[c], classes[c].substr(devId.length));

                        if(action === 'edit'){
                            if(classes[c].substr(devId.length) === '-view'){
                                divs[d].style.display = "none";
                            } else {
                                divs[d].style.display = "inline";
                            }
                        } else if(action === 'cancel'){
                            if(classes[c].substr(devId.length) === '-view'){
                                divs[d].style.display = "inline";
                            } else {
                                divs[d].style.display = "none";
                            }
                        } else if(action === 'save'){
                            if(classes[c].substr(devId.length) === '-view'){
                                divs[d].style.display = "inline";
                            } else {
                                divs[d].style.display = "none";
                            }
                        }
                    }
                }
            }
        }
    }
};

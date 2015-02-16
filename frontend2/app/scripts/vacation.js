/* global dataStore */
/* exported setVacation */

function setVacation(state){
    'use strict';
    var dataToSend = [{'type': 'userInput',
                       'data': {'key': 'vacation',
                                'label': 'controler',
                                'val': state
                               }
                     }];
    dataStore.network.put(JSON.stringify(dataToSend), function(testvar){console.log(testvar);});
} 

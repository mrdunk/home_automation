
# Return JSON list element when passed multiple in a list.
# eg:
#   [{"k1":"v1"}, {"k2","v2"}]
get_json_list_element(){
    JSON_LIST=$1
    TARGET=$2

    LIST_NUM=-1        
    COUNT_SQ=0        
    COUNT_CL=0        
          
    for LINE in $(echo $JSON_LIST | sed 's/{/ { /g' | sed 's/}/ } /g' | sed 's/\[/ \[ /g' | sed 's/\]/ \] /g' | sed 's/,/, /g' ); do
        if [ "[" == "$LINE" ]; then let COUNT_SQ=$COUNT_SQ+1; fi;                                                          
        if [ "{" == "$LINE" ]; then                                                                                        
            if [ $COUNT_CL -eq 0 ]; then let LIST_NUM=$LIST_NUM+1; fi;
            let COUNT_CL=$COUNT_CL+1;                                 
        fi;                                                      
                                                                 
        if [ $COUNT_CL -gt 0 ] && [ $TARGET -eq $LIST_NUM ] ; then echo -n $LINE; fi;      
                                                                        
        if [ "}" == "$LINE" ]; then let COUNT_CL=$COUNT_CL-1; fi;                             
        if [ "]" == "$LINE" ]; then let COUNT_SQ=$COUNT_SQ-1; fi;                         
    done                                                                                                
    echo
}

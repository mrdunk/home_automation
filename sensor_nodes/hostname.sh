
get_hostname(){
    HOSTNAME=$(hostname) 2> /dev/null
    if [ $? -ne 0 ]; then
        HOSTNAME=$(grep hostname /etc/config/system | cut -d "'" -f 2)
        if [ $? -ne 0 ]; then
            HOSTNAME="unknown"
        fi
    fi

    echo $HOSTNAME
}

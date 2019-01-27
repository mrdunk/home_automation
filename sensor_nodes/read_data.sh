#!/bin/sh

TMP_JSON_FILE=/tmp/1wire.json
DBHOST=192.168.192.254
MAX_TEMPERATURE=100

. /bin/1wire/output_json.sh

HOSTNAME=$(hostname) 2> /dev/null
if [ $? -ne 0 ]; then
    HOSTNAME=$(grep hostname /etc/config/system | cut -d "'" -f 2)
    if [ $? -ne 0 ]; then
        HOSTNAME="unknown"
    fi
fi

open_JSON $TMP_JSON_FILE

for SENSOR in $(ls -d /sys/bus/w1/devices/28-*)
do
    FILENAME="$SENSOR/w1_slave"
    SENSOR_ID=$(echo $SENSOR | tr "-" "\n" | grep -v "/sys/bus/w1/devices/28")
    TEMPERATURE=$(grep " t=" $FILENAME | tr "=" "\n" | grep -v "t")
    TEMPERATURE=$(awk "BEGIN{printf \"%.2f\n\", ($TEMPERATURE/1000)}")


    compile_JSON $TMP_JSON_FILE $HOSTNAME "1wire" $SENSOR_ID $TEMPERATURE
done

close_JSON $TMP_JSON_FILE

if [ "${TEMPERATURE%.*}" -lt "$MAX_TEMPERATURE" ]
then
    curl -X POST -d @$TMP_JSON_FILE http://$DBHOST:55555/put
    touch /tmp/sent
fi

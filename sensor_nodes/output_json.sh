
# Bash funtions to build JSON object.

compile_JSON() {
    FILENAME=$1
    TYPE=sensors
    HOST=$2
    LABEL=$3
    KEY=$4
    VAL=$5

    OUTPUT="\t{\n\t\t\"type\": \"$TYPE\",\n\t\t\"data\": {\n\t\t\t\"host\": \"$HOST\",\n\t\t\t\"label\": \"$LABEL\",\n\t\t\t\"key\": \"$KEY\",\n\t\t\t\"val\": \"$VAL\"}\n\t}\n\t,"
    echo -e $OUTPUT >> $FILENAME
}

open_JSON() {
    FILENAME=$1

    echo -e "[" > $FILENAME
}

close_JSON() {
    FILENAME=$1

    # Test if file has any content
    if grep -q "type" $FILENAME; then
        # Remove last trailing comma.
        sed -i '$ d' $FILENAME
    fi

    echo -e "]" >> $FILENAME
}

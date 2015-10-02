#! /bin/sh

  case "$1" in
    start)
        echo -n "Starting homeautomation: "
        homeautod 55555 /var/lib/homeautod/
        ;;
    stop)
        echo -n "Shutting down homeautomation: "
        killall homeautod
        ;;
    status)
        echo -n "Checking of homeautomation: "
        pgrep homeautod$
        ;;
    *)
        ## If no parameters are given, print which are avaiable.
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac


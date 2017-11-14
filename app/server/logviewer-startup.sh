#!/bin/sh
# Start/stop the logviewer-service.
#
### BEGIN INIT INFO
# Provides:          logviewer-service
# Required-Start:     
# Required-Stop:
# Default-Start:     2 3 4 5
# Default-Stop:
# Short-Description: LogViewer service to access to serial ports
### END INIT INFO

sudo forever start /home/csm/logviewer-service/service.js

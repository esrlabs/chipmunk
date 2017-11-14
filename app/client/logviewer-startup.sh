#!/bin/sh
# Start/stop the logviewer-service.
#
### BEGIN INIT INFO
# Provides:          logviewer-service
# Required-Start:    forever node
# Required-Stop:     forever
# Default-Start:     2 3 4 5
# Default-Stop:
# Short-Description: LogViewer service to access to serial ports
### END INIT INFO

forever start /home/csm/logviewer-service/service.js

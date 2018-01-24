#! /bin/sh

### BEGIN INIT INFO
# Provides:          logviewer-client
# Required-Start:    sudo
# Required-Stop:     sudo
# X-Start-Before:
# Default-Start:     2 3 4 5
# Default-Stop:
# Short-Description: LogViewer service to access to serial ports
# Description: LogViewer service to access to serial ports
### END INIT INFO

sudo forever start /home/pi/logviewer-client/server.js

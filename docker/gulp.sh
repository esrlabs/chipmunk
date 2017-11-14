#!/bin/bash

#Colors
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD_GREEN='\033[1;32m'

#Path to mount point in docker-container
OUTPUTPATH="application"

#Nodes modules
NODE_MODULES="./node_modules"

#Goto application folder
#Function, which provide moving
gotoAppFolder () {
  cd /$OUTPUTPATH
}
#Move to app-folder
gotoAppFolder

if [ ! -d "$NODE_MODULES" ]; then
    echo -e "${RED}Cannot run gulp: application isn't installed.${NC}"
else
    echo -e "Do you want run ${CYAN}gulp${NC})? (y/N): "
    read -t 3 -p "" run_gulp
    if echo "$run_gulp" | grep -iq "^y" ;then
        . gulp
    else
        echo -e "Have a nice work!"
    fi
fi

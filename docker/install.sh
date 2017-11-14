#!/bin/bash
#Colors
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD_GREEN='\033[1;32m'

echo "Check installation..."

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

#check installation
if [ ! -d "$NODE_MODULES" ]; then
    echo -e "${RED}Application isn't installed.${NC}"
    echo -e "Do you want install it (${CYAN}internet connection is required${NC})? (Y/n): "
    read -t 10 -p "" install
    if echo "$install" | grep -iq "^n" ;then
        echo -e "Please, install application using ${CYAN}npm run install${NC} manually"
    else
        npm run install
        echo
        echo -e "${CYAN}Installation is done. Please check console output above to be sure, that everything is okay.${NC}"
        echo
    fi
else
    echo "Application is already installed"
fi

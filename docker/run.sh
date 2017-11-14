#!/bin/bash
#Clear
clear

#Colors
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD_GREEN='\033[1;32m'

#Detect name of image for project
FILEID="`pwd`/container.id"
while IFS= read IMAGETAG
do
	echo "Searching container ID"
done <"$FILEID"

#Check image tag
if [ "$IMAGETAG" = "" ]
then
    echo -e "${RED}Image tag (name) not found. Check file ${CYAN}./container.id ${NC}"
    exit
fi

#911
echo -e "${BOLD_GREEN}Welcome to docker shell runner${NC}"
echo -e ""
echo -e "Used image: ${CYAN}$IMAGETAG${NC}"
echo -e ""
echo -e "${CYAN}==========================${NC}"
echo -e "If this script will not work as expected (you will not able to login into docker-container), try next:"
echo -e "- try build docker container and image using script ${CYAN}build.sh${NC}"
echo -e "- try login manually: ${CYAN}docker run -v [PATH_TO_THIS_FOLDER]../app:/application -it arch-instance${NC} (replace [PATH_TO_THIS_FOLDER] by absolute path to folder with this script)"
echo -e "${CYAN}==========================${NC}"
echo

##Declare variables
#Path to script folder
SCRIPTPATH=`pwd`
#Path to mount point in docker-container
OUTPUTPATH="/application"
#Current OS name
CURRENT_SYS=`uname`

##Define prefix to fix WIN based OS
if [[ "$CURRENT_SYS" =~ "msys" ]] || [[ "$CURRENT_SYS" =~ "win" ]] || [[ "$CURRENT_SYS" =~ "MSYS" ]] || [[ "$CURRENT_SYS" =~ "WIN" ]]
then
    echo "Windows is detected. If it isn't truth, correct this script"
    WIN_FIX="/"
else
    echo "Probably it's linux. If it isn't truth, correct this script"
    WIN_FIX=""
fi

echo
echo -e "${CYAN}Running docker...${NC}"
echo

#[-p] provide docker with port which should be bound between docker <--> host. For example you have
     #server on docker on port 3000. To open http://localhost:3000 on your host machine you should
     #use same parameter like bellow

docker run -p 3000:3000 \
            -v $WIN_FIX$SCRIPTPATH/../app:$WIN_FIX$OUTPUTPATH \
            -i \
            -t \
            -h `hostname` \
            --rm \
            $IMAGETAG


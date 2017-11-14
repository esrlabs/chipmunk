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

echo -e "Welcome to ${CYAN}Docker Build${NC} script"
echo -e ""
echo -e "Used image: ${CYAN}$IMAGETAG${NC}"
echo -e ""
echo -e "How you want to build container?"
echo -e "1) Using cache"
echo -e "2) Without cache - fresh build"
echo -e "3) Without cache - fresh build + try to find updates for basic image"
echo -e "4) Do nothing. Just exit."
echo -e "Type option (default 1):"
read -t 10 -p "" BUILDTYPE
case $BUILDTYPE in
	1)
        echo -e "Building ${CYAN}with${NC} cache"
        docker build --rm -t $IMAGETAG .
        break
		;;
	2)
        echo -e "Building ${CYAN}without${NC} cache"
        docker build --rm --no-cache -t $IMAGETAG .
        break
		;;
	3)
        echo -e "Building ${CYAN}without${NC} cache and ${CYAN}with updates${NC}"
        docker build --rm --no-cache --pull -t $IMAGETAG .
        break
		;;
	4)
	    echo "Buy!"
        break
		;;
	*)
        echo -e "Building ${CYAN}with${NC} cache"
        docker build --rm -t $IMAGETAG .
        break
		;;
esac

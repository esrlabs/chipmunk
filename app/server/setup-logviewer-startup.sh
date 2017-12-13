#! /bin/sh

sudo chmod +x ./logviewer-startup.sh
sudo cp ./logviewer-startup.sh /etc/init.d
sudo update-rc.d logviewer-startup.sh defaults 100
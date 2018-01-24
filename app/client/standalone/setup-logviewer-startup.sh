#! /bin/sh

sudo chmod +x ./logviewer-client-startup.sh
sudo cp ./logviewer-client-startup.sh /etc/init.d
sudo update-rc.d logviewer-client-startup.sh defaults 100
#sudo update-rc.d -f logviewer-client-startup.sh remove

#! /bin/sh

sudo apt install node npm
sudo npm cache clean -f
sudo npm install -g n
sudo n stable
sudo npm install forever --global
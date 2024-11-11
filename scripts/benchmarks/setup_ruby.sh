#!/bin/bash
# Need to install ruby separately because github action for installing ruby does not work on self hosted runner.
whoami
npm install -g corepack
corepack enable
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install -y yarn software-properties-common
apt-add-repository -y ppa:rael-gc/rvm
sudo apt-get update && sudo apt-get install -y rvm
echo 'source "/etc/profile.d/rvm.sh"' >> ~/.bashrc
source /etc/profile.d/rvm.sh
rvm install ruby-3.1.2
ruby --version
sudo chown -R $(whoami) /usr/local
rvm use 3.1.2 --default
export PATH="/usr/share/rvm:$PATH"
gem install dotenv json octokit tmpdir fileutils
curl https://sh.rustup.rs -sSf | RUSTUP_INIT_SKIP_PATH_CHECK=yes sh -s -- -y
rustup default stable
rustup update
export PATH="/root/.cargo/bin:$PATH"
source ~/.bashrc
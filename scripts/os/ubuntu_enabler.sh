#!/bin/bash
set -euo pipefail

PROFILE_URL="https://raw.githubusercontent.com/esrlabs/chipmunk-distribution/master/apt/apparmor/chipmunk"
PROFILE_NAME="chipmunk"
PROFILE_PATH="/etc/apparmor.d/$PROFILE_NAME"

if [[ $EUID -ne 0 ]]; then
    echo "Please run with sudo."
    exit 1
fi

if ! systemctl is-active --quiet apparmor; then
    echo "AppArmor is not active. Installing and enabling..."
    apt update
    apt install -y apparmor apparmor-utils
    systemctl enable apparmor
    systemctl start apparmor
fi

echo "Downloading Chipmunk AppArmor profile..."
curl -fsSL "$PROFILE_URL" -o "$PROFILE_PATH"
chmod 644 "$PROFILE_PATH"

echo "Reloading AppArmor profile..."
apparmor_parser -r "$PROFILE_PATH"

echo "Verifying profile load..."
aa-status | grep "$PROFILE_NAME" || {
    echo "Profile not loaded correctly!"
    exit 1
}

echo "AppArmor profile installed and active."
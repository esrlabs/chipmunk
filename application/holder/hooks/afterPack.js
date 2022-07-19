const fs = require('fs');
const path = require('path');

const LAUNCHERS = path.normalize(path.join(__dirname, '../../apps/launchers/target/release/'));
const RELEASE_BUILD_FOLDER = path.normalize(
    path.join(
        __dirname,
        `../release/${(() => {
            switch (process.platform) {
                case 'darwin':
                    return 'mac/chipmunk.app/Contents/MacOS';
                case 'linux':
                    return 'linux-unpacked';
                default:
                    return 'win-unpacked';
            }
        })()}`,
    ),
);
const LAUNCHER_NAME = 'launcher';
const APPLICATION_NAME = 'chipmunk';
const APP_NAME = 'app';
const UPDATER_NAME = 'updater';
const CLI_NAME = 'cm';

function getExecutable(filename) {
    const extention = process.platform === 'win32' ? '.exe' : '';
    return `${filename}${extention}`;
}

function delivery() {
    const appFile = path.normalize(
        path.join(RELEASE_BUILD_FOLDER, getExecutable(APPLICATION_NAME)),
    );
    const launcherFile = path.normalize(path.join(LAUNCHERS, getExecutable(LAUNCHER_NAME)));
    fs.renameSync(
        appFile,
        path.normalize(path.join(RELEASE_BUILD_FOLDER, getExecutable(APP_NAME))),
    );
    fs.renameSync(
        launcherFile,
        path.normalize(path.join(LAUNCHERS, getExecutable(APPLICATION_NAME))),
    );
    fs.copyFileSync(
        path.normalize(path.join(LAUNCHERS, getExecutable(APPLICATION_NAME))),
        path.normalize(path.join(RELEASE_BUILD_FOLDER, getExecutable(APPLICATION_NAME))),
    );
    fs.copyFileSync(
        path.normalize(path.join(LAUNCHERS, getExecutable(UPDATER_NAME))),
        path.normalize(path.join(RELEASE_BUILD_FOLDER, getExecutable(UPDATER_NAME))),
    );
    fs.copyFileSync(
        path.normalize(path.join(LAUNCHERS, getExecutable(CLI_NAME))),
        path.normalize(path.join(RELEASE_BUILD_FOLDER, getExecutable(CLI_NAME))),
    );
}

module.exports = async (context) => {
    delivery();
    return Promise.resolve();
};

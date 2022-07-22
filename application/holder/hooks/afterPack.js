const fs = require('fs');
const path = require('path');

const RELEASE_BIN_FOLDER = path.normalize(
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
const RELEASE_BINRES_FOLDER = path.normalize(
    path.join(
        __dirname,
        `../release/${(() => {
            switch (process.platform) {
                case 'darwin':
                    return 'mac/chipmunk.app/Contents/Resources/bin';
                case 'linux':
                    return 'linux-unpacked/Resources/bin';
                default:
                    return 'win-unpacked/Resources/bin';
            }
        })()}`,
    ),
);
const LAUNCHER_NAME = 'launcher';
const APPLICATION_NAME = 'chipmunk';
const APP_NAME = 'app';

function getExecutable(filename) {
    const extention = process.platform === 'win32' ? '.exe' : '';
    return `${filename}${extention}`;
}

function delivery() {
    fs.renameSync(
        path.normalize(path.join(RELEASE_BIN_FOLDER, getExecutable(APPLICATION_NAME))),
        path.normalize(path.join(RELEASE_BIN_FOLDER, getExecutable(APP_NAME))),
    );
    fs.copyFileSync(
        path.normalize(path.join(RELEASE_BINRES_FOLDER, getExecutable(LAUNCHER_NAME))),
        path.normalize(path.join(RELEASE_BIN_FOLDER, getExecutable(APPLICATION_NAME))),
    );
}

module.exports = async (context) => {
    delivery();
    return Promise.resolve();
};

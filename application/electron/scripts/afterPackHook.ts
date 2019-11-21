import * as path from 'path';
import * as fs from 'fs';
import {copyFolder} from '../src/tools/fs';

const APPLICATION_DIR = path.join(__dirname, "../../../..");
const ELECTRON_RELEASE_DIR = path.join(APPLICATION_DIR, "electron/dist/release");
const APPS_DIR = path.join(APPLICATION_DIR, "apps");

// tslint:disable-next-line:no-console
console.log(`APPLICATION_DIR=${APPLICATION_DIR}`);

function executableLocation(base: string, fileName: string) {
    switch (process.platform) {
        case 'darwin':
            const macFolder = `${base}/mac/chipmunk.app/Contents/MacOS`;
            return {
                folder: macFolder,
                path: `${macFolder}/${fileName}`,
            };
        case 'linux':
            const linuxFolder =  `${base}/linux-unpacked`;
            return {
                folder: linuxFolder,
                path: `${linuxFolder}/${fileName}`,
            };
        default: // windows
            const windowsFolder =  `${base}/linux-unpacked`;
            return {
                folder: windowsFolder,
                path: `${windowsFolder}/${fileName}`,
            };
    }
}

function getNodeModulesPath() {
    switch (process.platform) {
        case 'darwin':
            return `${ELECTRON_RELEASE_DIR}/mac/chipmunk.app/Contents/Resources/app/node_modules`;
        case 'linux':
            return `${ELECTRON_RELEASE_DIR}/linux-unpacked/resources/app/node_modules`;
        default: // windows
            return `${ELECTRON_RELEASE_DIR}/win-unpacked/resources/app/node_modules`;
    }
}

function getLauncherPath() {
    if (process.platform === 'win32') {
        return path.join(APPLICATION_DIR, 'electron/dist/compiled/apps/launcher.exe');
    }
    return path.join(APPLICATION_DIR, 'electron/dist/compiled/apps/launcher');
}

function taskRenaming() {
    const chipmunkExecPath = executableLocation(ELECTRON_RELEASE_DIR, 'chipmunk').path;
    const appExecPath = executableLocation(ELECTRON_RELEASE_DIR, 'app').path;
    // tslint:disable-next-line:no-console
    console.log(`rename from ${chipmunkExecPath} to ${appExecPath}`);
    fs.renameSync(chipmunkExecPath, appExecPath);
    fs.copyFileSync(getLauncherPath(), chipmunkExecPath);
}

function copyFolderExcept(srcFolder: string, destFolder: string, exceptions: string[]) {
    fs.readdirSync(srcFolder).forEach ((n: string) => {
        // tslint:disable-next-line:no-console
        console.log(`found n=${n}`);
        let skipFiles = false;
        exceptions.forEach ((ex: string) => {
            if (n.endsWith(ex)) {
                skipFiles = true;
            }
        });
        if (!skipFiles) {
            const fullname = path.join(srcFolder, n);
            if (fs.lstatSync(fullname).isDirectory() ) {
                // tslint:disable-next-line:no-console
                console.log(`copyFolder from ${fullname} to ${destFolder}`);
                copyFolder(fullname, destFolder);
            } else {
                // tslint:disable-next-line:no-console
                console.log(`copyFileSync from ${fullname} to ${path.join(destFolder, n)}`);
                fs.copyFileSync(fullname, path.join(destFolder, n));
            }
        }
    });
}

function taskCopying() {
    const dest = getNodeModulesPath();
    const srcFolder = `${APPS_DIR}/indexer-neon`;
    const destFolder = `${dest}/indexer-neon`;
    // tslint:disable-next-line:no-console
    console.log(`srcFolder ${srcFolder} , destFolder: ${destFolder}`);
    if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder);
    }
    copyFolderExcept(srcFolder, destFolder, ['node_modules', 'native', '.vscode']);
    const destNative = path.join(destFolder, 'native');
    const destNativeTarget = path.join(destNative, 'target');
    const destNativeRelease = path.join(destNativeTarget, 'release');
    if (!fs.existsSync(destNative)) {
        fs.mkdirSync(destNative);
    }
    if (!fs.existsSync(destNativeTarget)) {
        fs.mkdirSync(destNativeTarget);
    }
    if (!fs.existsSync(destNativeRelease)) {
        fs.mkdirSync(destNativeRelease);
    }
    ['artifacts.json', 'index.node'].forEach((fileName: string) => {
        fs.copyFileSync(path.join(srcFolder, 'native', fileName), path.join(destFolder, 'native', fileName));
    });
    const neonResources = path.resolve(path.join(srcFolder, 'native/target/release'));
    copyFolderExcept(neonResources, destNativeRelease, ['build', 'deps']);
}

export default async (context: any) => {
    // tslint:disable-next-line:no-console
    console.log("after pack: dirname=" + __dirname);
    taskRenaming();
    taskCopying();
};

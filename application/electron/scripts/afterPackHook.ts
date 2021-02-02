// tslint:disable:no-console
import * as path from "path";
import * as fs from "fs";
import { copyFolder } from "../src/tools/fs";

const APPLICATION_DIR = path.normalize(path.join(__dirname, "../../../.."));
const ELECTRON_RELEASE_DIR = path.join(APPLICATION_DIR, "electron", "dist", "release");
const APPS_DIR = path.join(APPLICATION_DIR, "apps");

// tslint:disable-next-line:no-console
console.log(`APPLICATION_DIR=${APPLICATION_DIR}`);

function executableLocation(base: string, fileName: string) {
    switch (process.platform) {
        case "darwin":
            const macFolder = `${base}/mac/chipmunk.app/Contents/MacOS`;
            return {
                folder: macFolder,
                path: `${macFolder}/${fileName}`,
            };
        case "linux":
            const linuxFolder = `${base}/linux-unpacked`;
            return {
                folder: linuxFolder,
                path: `${linuxFolder}/${fileName}`,
            };
        default:
            // windows
            const windowsFolder = path.join(base, 'win-unpacked');
            return {
                folder: path.resolve(windowsFolder),
                path: path.join(windowsFolder, `${fileName}.exe`),
            };
    }
}

function getNodeModulesPath() {
    switch (process.platform) {
        case "darwin":
            return `${ELECTRON_RELEASE_DIR}/mac/chipmunk.app/Contents/Resources/app/node_modules`;
        case "linux":
            return `${ELECTRON_RELEASE_DIR}/linux-unpacked/resources/app/node_modules`;
        default:
            // windows
            return path.join(ELECTRON_RELEASE_DIR, "win-unpacked", "resources", "app", "node_modules");
    }
}

function getLauncherPath() {
    if (process.platform === "win32") {
        return path.join(APPLICATION_DIR, "electron", "dist", "compiled", "apps", "launcher.exe");
    }
    return path.join(APPLICATION_DIR, "electron/dist/compiled/apps/launcher");
}

function getCLIPath() {
    if (process.platform === "win32") {
        return path.join(APPLICATION_DIR, "electron", "dist", "compiled", "apps", "cm.exe");
    }
    return path.join(APPLICATION_DIR, "electron/dist/compiled/apps/cm");
}

function taskRenaming() {
    const chipmunkExecPath = executableLocation(ELECTRON_RELEASE_DIR, "chipmunk").path;
    const appExecPath = executableLocation(ELECTRON_RELEASE_DIR, "app").path;
    console.log(`rename from ${chipmunkExecPath} to ${appExecPath}`);
    fs.renameSync(chipmunkExecPath, appExecPath);
    console.log(`copy file ${getLauncherPath()} to ${chipmunkExecPath}`);
    fs.copyFileSync(getLauncherPath(), chipmunkExecPath);
}
/*
function taskDeliveryCLI() {
    const cliExecPath = executableLocation(ELECTRON_RELEASE_DIR, "cm").path;
    console.log(`copy file ${getCLIPath()} to ${cliExecPath}`);
    fs.copyFileSync(getCLIPath(), cliExecPath);
}
*/
function copyFolderExcept(srcFolder: string, destFolder: string, exceptions: string[]) {
    // tslint:disable-next-line:no-console
    console.log(`[copyFolder] *****\n\tsrcFolder ${srcFolder}\n\tdestFolder: ${destFolder}`);
    fs.readdirSync(srcFolder).forEach((item: string) => {
        // tslint:disable-next-line:no-console
        let skipFiles = false;
        exceptions.forEach((ex: string) => {
            if (item.endsWith(ex)) {
                skipFiles = true;
            }
        });
        if (!skipFiles) {
            const fullname = path.join(srcFolder, item);
            if (fs.lstatSync(fullname).isDirectory()) {
                // tslint:disable-next-line:no-console
                console.log(`copyFolder ${item}`);
                copyFolder(fullname, destFolder);
            } else {
                // tslint:disable-next-line:no-console
                console.log(`copyFile ${item}`);
                fs.copyFileSync(fullname, path.join(destFolder, item));
            }
        } else {
            // tslint:disable-next-line:no-console
            console.log(`skipping: ${item}`);
        }
    });
}

function taskCopying() {
    const dest = getNodeModulesPath();
    const srcFolder = path.join(APPS_DIR, 'rustcore');
    const destFolder = `${dest}/rustcore`;
    if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder);
    }
    copyFolderExcept(srcFolder, destFolder, ["node_modules", "native", ".vscode"]);
    const destNative = path.join(destFolder, "native");
    const destNativeTarget = path.join(destNative, "target");
    const destNativeRelease = path.join(destNativeTarget, "release");
    if (!fs.existsSync(destNative)) {
        fs.mkdirSync(destNative);
    }
    if (!fs.existsSync(destNativeTarget)) {
        fs.mkdirSync(destNativeTarget);
    }
    if (!fs.existsSync(destNativeRelease)) {
        fs.mkdirSync(destNativeRelease);
    }
    ["artifacts.json", "index.node"].forEach((fileName: string) => {
        fs.copyFileSync(
            path.join(srcFolder, "native", fileName),
            path.join(destFolder, "native", fileName),
        );
    });
    const neonResources = path.resolve(path.join(srcFolder, "native", "target", "release"));
    copyFolderExcept(neonResources, destNativeRelease, ["build", "deps"]);
}

export default async (context: any) => {
    // tslint:disable-next-line:no-console
    console.log("after pack: dirname=" + __dirname);
    taskRenaming();
    // taskDeliveryCLI();
    taskCopying();
};

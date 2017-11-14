const TASKS = {
    BUILD_DARWIN    : 'building Darwin',
    BUILD_LINUX     : 'building Linux',
    BUILD_WIN       : 'building Windows',
    DEFAULT         : 'default'
};

const gulp      = require('gulp');
const builder   = require("electron-builder");

const CONFIGURATION = {
    [TASKS.BUILD_DARWIN] : {
        appId           : 'com.logviewer.de',
        productName     : 'LogViewer',
        copyright       : 'Copyright © 2017 year E.S.R.Labs',
        directories     :{
            output  : 'dist'
        },
        mac: {
            category: "public.app-category.developer-tools",
        },
        npmRebuild      : true
    },
    [TASKS.BUILD_LINUX] : {
        appId           : 'com.logviewer.de',
        productName     : 'LogViewer',
        copyright       : 'Copyright © 2017 year E.S.R.Labs',
        directories     :{
            output  : 'dist'
        },
        linux: {
            category: "public.app-category.developer-tools",
        },
        npmRebuild      : true
    },
    [TASKS.BUILD_WIN] : {
        appId           : 'com.logviewer.de',
        productName     : 'LogViewer',
        copyright       : 'Copyright © 2017 year E.S.R.Labs',
        directories     :{
            output  : 'dist'
        },
        win: {
            target: [
                {
                    target: "msi",
                    arch: [
                        "x64",
                        "ia32"
                    ]
                }
            ]
        },
        npmRebuild      : true
    }
};

const PLATFORMS = {
    'darwin'    : TASKS.BUILD_DARWIN,
    'linux'     : TASKS.BUILD_LINUX,
    'win32'     : TASKS.BUILD_WIN
};

class BuildingTasks {

    constructor(){
        this._createBuildTask(this._getTaskForPlatform());
        this._create();
    }

    _getTaskForPlatform(){
        if (PLATFORMS[process.platform] !== void 0) {
            console.log(`Apply task: ${PLATFORMS[process.platform]} for ${process.platform}.`);
            return PLATFORMS[process.platform];
        } else {
            throw new Error(`Cannot find task for current platform: ${process.platform}`);
        }
    }

    _createBuildTask(task){
        gulp.task(task, (done) => {
            builder.build({
                    config: CONFIGURATION[task]
                })
                .then(() => {
                    done();
                })
                .catch((error) => {
                    this._onOutput(task, error.message);
                });
        });
    }

    _onOutput(task, data){
        console.log(`[${task}]: ${data}`);
    }


    _create(){
        gulp.task(TASKS.DEFAULT, gulp.series(
            this._getTaskForPlatform()
        ));
    }

}

let buildTasks = new BuildingTasks();
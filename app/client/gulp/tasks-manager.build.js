
const TASKS = {
    BUILD   : 'building',
    COMPILE : 'compile',
    NPM     : 'npm',
    COPY    : 'copy'
};

const PLATFORMS = {
    DARWIN    : 'darwin',
    LINUX     : 'linux',
    WIN32     : 'win32'
};

const PATHS = require('./config.js');

const gulp      = require('gulp');
const spawn     = require('child_process').spawn;

class BuildingTasks {

    constructor(){
        this._npm = null;
        this._detectNPM();
        this._createCompileTasks();
        this._createNPMTasks();
        this._createCopyTask();
        this._create();
        const StringDecoder = require('string_decoder').StringDecoder;
        this._decoder       = new StringDecoder('utf8');
        process.env.FORCE_COLOR = true;
    }

    _detectNPM(){
        this._npm = 'npm';
        if (process.platform === PLATFORMS.WIN32) {
            this._npm = 'npm.cmd';
        }
    }

    _createCompileTasks(){
        this._createSpawnTask(TASKS.COMPILE, this._npm, ['run', 'build']);
    }

    _createNPMTasks(){
        this._createSpawnTask(TASKS.NPM, this._npm, ['install', '--production'], { cwd: `./${PATHS.OUT.BASE}` })
    }

    _createSpawnTask(task, cmd, args = [], opts = {}){
        gulp.task(task, (done) => {
            this._attachProcess(spawn(cmd, args, Object.assign(opts, { env: process.env })), task, done);
        });
    }

    _attachProcess(_process, task, done){
        _process.stdout.on('data', this._onOutput.bind(this, task));
        _process.stderr.on('data', this._onOutput.bind(this, task));
        _process.on('close', done);
    }

    _onOutput(task, data){
        var message = this._decoder.write(data);
        console.log(`[${task}]: ${message.trim()}`);
    }

    _createCopyTask(){
        gulp.task(TASKS.COPY, function(callback){
            let CopyFolders     = require('./tools.copyfolders.js'),
                copyFolders     = new CopyFolders({ src: PATHS.IN.BASE, dest: PATHS.OUT.BASE, exclude: [PATHS.IN.LESS]});
            copyFolders.copy();
            copyFolders.copyFile('./package.json', PATHS.OUT.BASE + '/package.json');
            return callback();
        });
    }


    _create(){
        gulp.task(TASKS.BUILD, gulp.series(
            TASKS.COMPILE,
            TASKS.COPY,
            TASKS.NPM
        ));
    }

    getTaskName(){
        return TASKS.BUILD;
    }
}

module.exports = new BuildingTasks();

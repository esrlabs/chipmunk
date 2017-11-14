
const TASKS = {
    BUILD   : 'building',
    COMPILE : 'compile',
    NPM     : 'npm',
    COPY    : 'copy'
};

const PATHS = require('./config.js');

const gulp      = require('gulp');
const spawn     = require('child_process').spawn;

class BuildingTasks {

    constructor(){
        this._createCompileTasks();
        this._createNPMTasks();
        this._createCopyTask();
        this._create();
    }

    _createCompileTasks(){
        gulp.task(TASKS.COMPILE, (done) => {
            this._process = spawn('npm', ['run', 'build']);
            this._process.stdout.on('data', this._onOutput.bind(this, TASKS.COMPILE));
            this._process.stderr.on('data', this._onOutput.bind(this, TASKS.COMPILE));
            this._process.on('close', done);
        });
    }

    _createNPMTasks(){
        gulp.task(TASKS.NPM, (done) => {
            this._process = spawn('npm', ['install', '--production'], { cwd: './build' });
            this._process.stdout.on('data', this._onOutput.bind(this, TASKS.NPM));
            this._process.stderr.on('data', this._onOutput.bind(this, TASKS.NPM));
            this._process.on('close', done);
        });
    }

    _onOutput(task, data){
        console.log(`[${task}]: ${data}`);
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

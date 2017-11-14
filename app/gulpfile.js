const TASKS = {
    BUILD           : 'building',
    INSTALL_CLIENT  : 'install_client',
    INSTALL_ELECTRON: 'install_electron',
    ADD_DEPENDENCIES: 'add_dependencies',
    BUILD_CLIENT    : 'build_client',
    COPY_CLIENT     : 'copy_client',
    COPY_SERVER     : 'copy_server',
    RESET_CLIENT    : 'reset_client',
    RESET_SERVER    : 'reset_server',
    MAKEDIR_CLIENT  : 'makedir_client',
    MAKEDIR_SERVER  : 'makedir_server',
    BACKUP_APP_PG   : 'backup_package.json',
    RESTORE_APP_PG  : 'restore_package.json',
    CLEANUP         : 'cleanup',
    CLEAR_APP       : 'clear_app',
    CLEAR_APP_SERVER: 'clear_app_server',
    CLEAR_DIST      : 'clear_dist',
    DEFAULT         : 'default'
};

const PLATFORMS_DEPS = {
    COMMON      : {
        "electron"          : "latest",
        "electron-builder"  : "latest"
    },
    'darwin'    : {
    },
    'linux'     : {
        "7zip-bin-linux"    : "latest"
    },
    'win32'     : {
    }
};

const gulp      = require('gulp');
const spawn     = require('child_process').spawn;

class BuildingTasks {

    constructor(){

    }

    _getDepsForPlatform(){
        if (PLATFORMS_DEPS[process.platform] !== void 0) {
            return Object.assign(PLATFORMS_DEPS.COMMON, PLATFORMS_DEPS[process.platform]);
        } else {
            throw new Error(`Cannot find dependenciesDev for current platform: ${process.platform}`);
        }
    }

    [TASKS.CLEAR_APP](){
        this._createSpawnTask(TASKS.CLEAR_APP, 'rm', ['-rf', 'node_modules'], { cwd: './desktop' });
    }

    [TASKS.CLEAR_APP_SERVER](){
        this._createSpawnTask(TASKS.CLEAR_APP_SERVER, 'rm', ['-rf', 'node_modules'], { cwd: './desktop/server' });
    }

    [TASKS.RESET_CLIENT](){
        this._createSpawnTask(TASKS.RESET_CLIENT, 'rm', ['-rf', 'client'], { cwd: './desktop' });
    }

    [TASKS.RESET_SERVER](){
        this._createSpawnTask(TASKS.RESET_SERVER, 'rm', ['-rf', 'server'], { cwd: './desktop' });
    }

    [TASKS.MAKEDIR_CLIENT](){
        this._createSpawnTask(TASKS.MAKEDIR_CLIENT, 'mkdir', ['client'], { cwd: './desktop' });
    }

    [TASKS.MAKEDIR_SERVER](){
        this._createSpawnTask(TASKS.MAKEDIR_SERVER, 'mkdir', ['server'], { cwd: './desktop' });
    }

    [TASKS.CLEAR_DIST](){
        this._createSpawnTask(TASKS.CLEAR_DIST, 'rm', ['-rf', 'dist'], { cwd: './desktop' });
    }

    [TASKS.INSTALL_CLIENT](){
        this._createSpawnTask(TASKS.INSTALL_CLIENT, 'npm', ['install'], { cwd: './client' });
    }

    [TASKS.BUILD_CLIENT](){
        this._createSpawnTask(TASKS.BUILD_CLIENT, 'npm', ['run', 'dist'], { cwd: './client' });
    }

    [TASKS.COPY_SERVER](){
        this._createSpawnTask(TASKS.COPY_SERVER, 'cp', ['-a', './server/.', './desktop/server']);
    }

    [TASKS.COPY_CLIENT](){
        this._createSpawnTask(TASKS.COPY_CLIENT, 'cp', ['-a', './client/build/.', './desktop/client']);
    }

    [TASKS.BACKUP_APP_PG](){
        this._createSpawnTask(TASKS.BACKUP_APP_PG, 'cp', ['-rf', './desktop/package.json', './desktop/package.backup.json']);
    }

    [TASKS.RESTORE_APP_PG](){
        this._createSpawnTask(TASKS.RESTORE_APP_PG, 'cp', ['-rf', './desktop/package.backup.json', './desktop/package.json']);
    }

    [TASKS.CLEANUP](){
        this._createSpawnTask(TASKS.CLEANUP, 'rm', ['-rf', './desktop/package.backup.json']);
    }

    [TASKS.ADD_DEPENDENCIES](){
        gulp.task(TASKS.ADD_DEPENDENCIES, (done) => {
            const FS = require('fs');
            let _app            = FS.readFileSync('app/package.json', {encoding: 'utf8'});
            let _server         = FS.readFileSync('app/server/package.json', {encoding: 'utf8'});
            let devDependencies = this._getDepsForPlatform();
            _app    = JSON.parse(_app);
            _server = JSON.parse(_server);
            _app.dependencies       = Object.assign(_app.dependencies, _server.dependencies);
            _app.devDependencies    = Object.assign(_app.devDependencies, devDependencies);
            FS.writeFileSync('app/package.json', JSON.stringify(_app), { encoding: 'utf8' });
            done();
        });
    }

    [TASKS.INSTALL_ELECTRON](){
        this._createSpawnTask(TASKS.INSTALL_ELECTRON, 'npm', ['install'], { cwd: './app' });
    }

    [TASKS.BUILD](){
        this._createSpawnTask(TASKS.BUILD, 'npm', ['run', 'dist'], { cwd: './app' });
    }

    _onOutput(task, data){
        console.log(`[${task}]: ${data}`);
    }

    _createSpawnTask(task, ...args){
        gulp.task(task, (done) => {
            this._attachProcess(spawn(...args), task, done);
        });
    }

    _attachProcess(_process, task, done){
        _process.stdout.on('data', this._onOutput.bind(this, task));
        _process.stderr.on('data', this._onOutput.bind(this, task));
        _process.on('close', done);
    }

    _getTasks(){
        return Object.keys(TASKS).filter((key) => {
            return TASKS[key] !== TASKS.DEFAULT;
        }).map(key => TASKS[key]);
    }

    create(){
        this._getTasks().forEach((task) => {
            this[task]();
        });
        gulp.task(TASKS.DEFAULT, gulp.series(
            TASKS.RESET_SERVER,
            TASKS.RESET_CLIENT,
            TASKS.CLEAR_DIST,
            TASKS.INSTALL_CLIENT,
            TASKS.BUILD_CLIENT,
            TASKS.MAKEDIR_SERVER,
            TASKS.MAKEDIR_CLIENT,
            TASKS.COPY_SERVER,
            TASKS.COPY_CLIENT,
            TASKS.BACKUP_APP_PG,
            TASKS.ADD_DEPENDENCIES,
            TASKS.CLEAR_APP,
            TASKS.CLEAR_APP_SERVER,
            TASKS.INSTALL_ELECTRON,
            TASKS.BUILD,
            TASKS.RESTORE_APP_PG,
            TASKS.CLEANUP,
            TASKS.CLEAR_APP,
            TASKS.CLEAR_APP_SERVER
        ));
    }

}

let buildTasks = new BuildingTasks();
buildTasks.create();
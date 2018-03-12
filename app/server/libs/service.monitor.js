const logger        = new (require('./tools.logger'))('ServiceMonitor');
const Events        = require('events');
const Path          = require('path');
const SerialPort    = require('serialport');
const FileManager   = require('./tools.filemanager');
const pathSettings  = require('./tools.settings.paths');

const DEFAULT_SETTINGS = {
    timeoutOnError: 5000,
    timeoutOnClose: 2000,
    maxFileSizeMB: 100,
    maxFilesCount: 10,
    port: '',
    portSettings: {},
    command: '',
    path: ''
};

class Settings{

    constructor(settings){
        settings = typeof settings === 'object' ? (settings !== null ? settings : {}) : {};
        this.timeoutOnError = typeof settings.timeoutOnError=== 'number' ? (settings.timeoutOnError >= 1    ? settings.timeoutOnError   : DEFAULT_SETTINGS.timeoutOnError)  : DEFAULT_SETTINGS.timeoutOnError;
        this.timeoutOnClose = typeof settings.timeoutOnClose=== 'number' ? (settings.timeoutOnClose >= 1    ? settings.timeoutOnClose   : DEFAULT_SETTINGS.timeoutOnClose)  : DEFAULT_SETTINGS.timeoutOnClose;
        this.maxFileSizeMB  = typeof settings.maxFileSizeMB === 'number' ? (settings.maxFileSizeMB >= 1     ? settings.maxFileSizeMB    : DEFAULT_SETTINGS.maxFileSizeMB)   : DEFAULT_SETTINGS.maxFileSizeMB;
        this.maxFilesCount  = typeof settings.maxFilesCount === 'number' ? (settings.maxFilesCount >= 1     ? settings.maxFilesCount    : DEFAULT_SETTINGS.maxFilesCount)   : DEFAULT_SETTINGS.maxFilesCount;
        this.port           = typeof settings.port          === 'string' ? (settings.port.trim() !== ''     ? settings.port             : DEFAULT_SETTINGS.port)            : DEFAULT_SETTINGS.port;
        this.portSettings   = typeof settings.portSettings  === 'object' ? (settings.portSettings !== null  ? settings.portSettings     : DEFAULT_SETTINGS.portSettings)    : DEFAULT_SETTINGS.portSettings;
        this.command        = typeof settings.command       === 'string' ? (settings.command.trim() !== ''  ? settings.command          : DEFAULT_SETTINGS.command)         : DEFAULT_SETTINGS.command;
        this.path           = typeof settings.path          === 'string' ? (settings.path.trim() !== ''     ? settings.path             : DEFAULT_SETTINGS.path)            : DEFAULT_SETTINGS.path;
    }
}

class SettingsManager {

    constructor(){
        this._fileManager   = new FileManager();
    }

    load(){
        let loadedSetting = this._fileManager.load(pathSettings.SETTINGS_FILE);
        loadedSetting = this._fileManager.bufferToJSON(loadedSetting);
        return loadedSetting !== null ? loadedSetting : (new Settings());
    }

    save(settings){
        this._fileManager.save(JSON.stringify(settings), pathSettings.SETTINGS_FILE);
    }

    reset() {
        this._fileManager.deleteFile(pathSettings.SETTINGS_FILE);
        this.save(new Settings());
    }

}

const PORT_EVENTS = {
    open    : 'open',
    data    : 'data',
    error   : 'error',
};

class Port extends Events.EventEmitter {

    constructor(port, settings){
        super();
        this.GUID           = (require('uuid/v1'))();
        this.port           = port;
        settings.lock       = false;
        this.settings       = settings;
        settings.autoOpen   = false;
        this.instance       = null;
        this.EVENTS         = {
            ON_DATA : Symbol(),
            ON_ERROR: Symbol(),
            ON_CLOSE: Symbol()
        };
        this.close = this.close.bind(this);
        this.bind();
    }

    bind(){
        process.on('exit', this.close);
    }

    unbind(){
        process.removeListener('exit', this.close);
    }

    open(){
        try {
            this.instance = new SerialPort(this.port, this.settings);
            this.instance.open((error) => {
                if (error) {
                    logger.error('[session: ' + this.GUID + ']:: Fail to open port: ' + this.port + '. Error: ' + error.message);
                    this.close(() => {});
                    this.emit(this.EVENTS.ON_ERROR, error);
                } else {
                    logger.debug('[session: ' + this.GUID + ']:: Port is opened: ' + this.port);
                }
            });
            //Attach events
            Object.keys(PORT_EVENTS).forEach((event)=>{
                this.instance.on(PORT_EVENTS[event], this['on' + event].bind(this));
            });
        } catch (error){
            logger.error('[session: ' + this.GUID + ']:: Fail to create port: ' + this.port + '. Error: ' + error.message);
            this.emit(this.EVENTS.ON_ERROR, error);
        }
    }

    getPort(){
        return this.port;
    }


    close(){
        this.unbind();
        if (this.instance !== null) {
            try {
                this.instance.close(() => {

                });
            } catch (error) {
                this.emit(this.EVENTS.ON_ERROR, error);
                logger.debug(`[session: ${this.GUID}]:: Error during closing port: ${this.port}. Error: ${error.message}.`);
            }
            this.instance = null;
            logger.debug('[session: ' + this.GUID + ']:: Port is closed: ' + this.port);
        } else {
            logger.warning('[session: ' + this.GUID + ']:: Port is already closed: ' + this.port);
        }
    }

    ['on' + PORT_EVENTS.open](){
    }

    ['on' + PORT_EVENTS.error](error){
        this.emit(this.EVENTS.ON_ERROR, error);
    }

    ['on' + PORT_EVENTS.data](data){
        try {
            typeof data.toString === 'function' && this.emit(this.EVENTS.ON_DATA, data.toString('utf8'));
        } catch (error) {
            logger.error('[session: ' + this.GUID + ']:: Error during reading data from: ' + this.port + '. Error: ' + error.message);
        }
    }
}

const
    spawn           = require('child_process').spawn,
    StringDecoder   = require('string_decoder').StringDecoder;

const PLATFORMS = {
    DARWIN    : 'darwin',
    LINUX     : 'linux',
    WIN32     : 'win32'
};

class SpawnProcess extends Events.EventEmitter{

    constructor(command, path) {
        super();
        this.error      = null;
        this.spawn      = null;
        this.alias      = null;
        this.command    = command;
        this.parameters = [];
        this.path       = path;
        this.decoder    = new StringDecoder('utf8');
        this.onData     = this.onData.bind(this);
        this.EVENTS     = {
            ON_DATA : Symbol(),
            ON_ERROR: Symbol(),
            ON_CLOSE: Symbol()
        };
        this.close = this.close.bind(this);
        this.bind();
    }

    bind(){
        process.on('exit', this.close);
    }

    unbind(){
        process.removeListener('exit', this.close);
    }

    validate(command, parameters, path){
        this.error = null;
        if (typeof this.command !== 'string' || this.command.trim() === '') {
            this.error = new Error(logger.error(`Expect command will be not empty {string}, but format is: ${(typeof this.command)}.`));
        } else {
            let parts       = this.command.split(' ').filter((part) => {
                return part.trim() !== '';
            });
            this.alias      = this.setAlias(parts[0]);
            this.parameters = parts.length > 1 ? parts.slice(1, parts.length) : [];
        }
        this.path = this.setPath(this.path);
        return this.error === null;
    }

    getAlias(){
        return this.alias;
    }

    setAlias(alias){
        if (process.platform === PLATFORMS.WIN32) {
            alias = alias + (~alias.search(/\.exe$/gi) ? '' : '.exe');
        }
        return alias;
    }

    setPath(path){
        if (typeof path !== 'string' || path.trim() === ''){
            path = process.env.PATH;
            if (~path.indexOf('/usr/bin') !== -1 || ~path.indexOf('/usr/sbin') !== -1){
                //Linux & darwin patch
                path.indexOf('/usr/local/bin'  ) === -1 && (path = '/usr/local/bin:' + path);
                path.indexOf('/usr/local/sbin' ) === -1 && (path = '/usr/local/sbin:' + path);
            }
            return path;
        } else {
            return path + ':' + process.env.PATH;
        }
    }

    open() {
        if (!this.validate()) {
            return this.emit(this.EVENTS.ON_ERROR, this.getError());
        }
        try {
            this.spawn = spawn(this.alias, this.parameters, {
                env: {
                    PATH: this.path
                }
            })
                .on('error', (error) => {
                    this.error = new Error(logger.error(`[$Error to execute ${this.alias}: ${error.message}. PATH=${this.path}`));
                    this.spawn = null;
                    return this.emit(this.EVENTS.ON_ERROR, this.getError());
                })
                .on('close',        this.onClose.bind(this))
                .on('disconnect',   this.onClose.bind(this))
                .on('exit',         this.onClose.bind(this));
            this.error = null;
        } catch (error) {
            this.error = error;
            this.spawn = null;
        }
        if (this.spawn === null) {
            return this.emit(this.EVENTS.ON_ERROR, this.getError());
        }
        if (this.spawn !== null && (typeof this.spawn.pid !== 'number' || this.spawn.pid <= 0)){
            this.error = new Error(logger.error(`[Fail to execute ${this.alias}. PATH=${this.path}`));
            this.spawn = null;
            return this.emit(this.EVENTS.ON_ERROR, this.getError());
        }
        this.spawn.stdout.on('data', this.onData);
        return this.spawn;
    }

    decodeBuffer(data){
        try {
            return this.decoder.write(data);
        } catch (error){
            return null;
        }
    }

    onData(data) {
        let decoded = null;
        try {
            decoded = this.decodeBuffer(data);
        } catch (error){
            decoded = null;
        }
        typeof decoded === 'string' && this.emit(this.EVENTS.ON_DATA, decoded);
    }

    getError() {
        return this.error;
    }

    onClose(code, signal) {
        this.emit(this.EVENTS.ON_CLOSE, code, signal);
    }

    close() {
        try {
            this.unbind();
            this.spawn !== null && this.spawn.stdout.removeListener('data', this.onData);
            this.spawn !== null && this.spawn.kill();
            this.spawn  = null;
        } catch (error){
            this.spawn  = null;
            this.error  = error;
        }
    }
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Buffer manager
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const BUFFER_OPTIONS = {
    BYTES_TO_WRITE          : 1024 * 5,
    DURATION_PER_DATA_EVENT : 2000 //ms. If duration between on Data event less than here, data will be included into one package
};

class BufferManager extends Events.EventEmitter {

    constructor() {
        super();
        this.timer      = -1;
        this.buffer     = '';
        this.onTimer    = this.onTimer.bind(this);
        this.EVENTS     = {
            ON_DATA: Symbol()
        };
    }

    onTimer(){
        if (this.buffer.trim() !== '') {
            let buffer  = this.buffer;
            this.buffer = '';
            this.drop();
            this.emit(this.EVENTS.ON_DATA, buffer);
        }
    }

    drop() {
        this.timer !== -1 && clearTimeout(this.timer);
        this.timer  = -1;
    }

    wait(){
        this.timer = setTimeout(this.onTimer, BUFFER_OPTIONS.DURATION_PER_DATA_EVENT);
    }

    add(buffer){
        if (typeof buffer === 'string'){
            this.drop();
            this.buffer += buffer;
            this.wait();
        }
    }

}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Storing manager
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
class StoringManager{

    constructor(settings) {
        this._fileManager       = new FileManager();
        this._bufferManager     = new BufferManager();
        this._current           = null;
        this._currentFileName   = null;
        this._settings          = settings;
        this._onWriteData       = this._onWriteData.bind(this);
        this._bufferManager.on(this._bufferManager.EVENTS.ON_DATA, this._onWriteData);
    }

    checkFolders() {
        let error = null;
        error = error !== null ? error : this._fileManager.createFolder(pathSettings.ROOT);
        error = error !== null ? error : this._fileManager.createFolder(pathSettings.LOGS_ROOT);
        error = error !== null ? error : this._fileManager.createFolder(pathSettings.LOGS_FOLDER);
        return error;
    }

    updateSettings(settings) {
        this._settings = settings;
    }

    add(str){
        this._bufferManager.add(str);
    }

    getFilesData(){
        return {
            list    : this._getFileList(),
            register: this._getFilesData()
        };
    }

    removeLogsFiles(){
        let files = this._getFileList();
        files instanceof Array && files.forEach((file) => {
            logger.info(`Removing logs file: ${Path.join(pathSettings.LOGS_FOLDER, file)}.`);
            this._fileManager.deleteFile(Path.join(pathSettings.LOGS_FOLDER, file));
        });
        this._clearRegister();
        this._dropCurrent();
    }

    getFileContent(fileName){
        let files = this._getFileList();
        if (!(files instanceof Array)) {
            return new Error(`No any files found.`);
        }
        if (files.indexOf(fileName) === -1) {
            return new Error(`File ${fileName} isn't found.`);
        }
        return this._getFileContent(fileName);
    }

    getAllFilesContent(){
        return new Promise((resolve, reject) => {
            let files = this._getFileList();

            if (!(files instanceof Array)) {
                return reject(new Error(`No any files found.`));
            }
            const name = (new Date()).getTime() + '.logs';
            const destfile = Path.join(pathSettings.DOWNLOADS, name);

            this._fileManager.glueFiles(files.map((file) => {
                return Path.join(pathSettings.LOGS_FOLDER, file);
            }), destfile, '\n')
                .then(() => {
                    resolve(name);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    getMatches(reg, search){
        function serializeReg(str){
            let chars = '{}[]+$^/!.*|\\():?,=';
            Array.prototype.forEach.call(chars, (char) => {
                str = str.replace(new RegExp('\\' + char, 'gi'), '\\' + char);
            });
            return str;
        };
        function getIndex(indexes, index){
            for (let i = index; i >= 0; i += 1) {
                if (indexes[i] !== void 0) {
                    return {
                        index: indexes[i],
                        start: i
                    };
                }
            }
            return {
                index: -1,
                start: -1
            };
        };
        let files = this._getFileList();
        if (!(files instanceof Array)) {
            return new Error(`No any files found.`);
        }
        let result = {};
        files.forEach((fileName) => {
            let content = this._getFileContent(fileName);
            result[fileName] = {};
            typeof content === 'string' && search.forEach((search) => {
                let request = reg ? search : serializeReg(search);
                let regExp  = new RegExp(request, 'gi');
                let lines   = content.split(/\r?\n|\r/gi);
                let total   = -1;
                let indexes = {};
                lines.forEach((line, index) => {
                    total += line.length + 1;
                    indexes[total] = index;
                });
                let matchesIndexes = [];//Still need it?
                let matches = [];
                do {
                    let match = regExp.exec(content);
                    let index = null;
                    if (match !== null) {
                        index = match.index;
                        matchesIndexes.push(index);
                        index = getIndex(indexes, index);
                        if (index.index !== -1 && lines[index.index] !== void 0) {
                            matches.push(lines[index.index]);
                            regExp.lastIndex < index.start && (regExp.lastIndex = index.start);
                        }
                    } else {
                        break;
                    }
                } while(true);
                result[fileName][search] = matches;
            });
        });
        return result;
    }

    _onWriteData(str){
        if (typeof str !== 'string' || str === '') {
            return false;
        }
        this._checkFile();
        return this._fileManager.append(str, this._current);
    }

    _getFileName(){
        let date = new Date();
        return date.getTime() + '.logs';
    }

    _checkFile(){
        if (this._settings === null) {
            return false;
        }
        this._resetCurrent();
        let size = this._fileManager.getSize(this._current);
        if (size === -1) {
            //file doesn't exist
            logger.error(`Logs file wasn't created. This is unexpected error. Permissions to FS should be checked.`);
        } else if (size >= this._settings.maxFileSizeMB * 1024 * 1024) {
            //size of file is too big
            this._updateRegister(-1, (new Date()).getTime(), size);
            logger.info(`Logs file ${this._currentFileName} is more than ${this._settings.maxFileSizeMB * 1024 * 1024} bytes and will be closed.`);
            this._dropCurrent();
            this._resetCurrent();
            logger.info(`New logs file ${this._currentFileName} is created.`);
        } else {
            this._updateRegister(-1, (new Date()).getTime(), size);
        }
    }

    _getFileList(){
        return this._fileManager.getListOfFile(pathSettings.LOGS_FOLDER);
    }

    _getFilesData(){
        let data = this._fileManager.load(pathSettings.REGISTER_FILE);
        data = this._fileManager.bufferToJSON(data);
        return data !== null ? data : {};
    }

    _getFileContent(fileName){
        let content = this._fileManager.load(Path.join(pathSettings.LOGS_FOLDER, fileName));
        return this._fileManager.decodeBuffer(content);
    }

    _updateRegister(opened, closed, size){
        let register = this._fileManager.bufferToJSON(this._fileManager.load(pathSettings.REGISTER_FILE));
        if (register === null) {
            register = {};
        }
        this._resetCurrent();
        if (register[this._currentFileName] === void 0) {
            register[this._currentFileName] = {
                opened: -1,
                closed: -1,
                size: size
            };
        }
        opened  !== -1 && (register[this._currentFileName].opened   = opened);
        closed  !== -1 && (register[this._currentFileName].closed   = closed);
        size    !== -1 && (register[this._currentFileName].size     = size);
        this._fileManager.save(JSON.stringify(register), pathSettings.REGISTER_FILE);
    }

    _clearRegister(){
        this._fileManager.deleteFile(pathSettings.REGISTER_FILE);
    }

    _dropCurrent(){
        this._currentFileName = null;
        this._current = null;
    }

    _resetCurrent(){
        if (this._currentFileName === null || this._current === null) {
            this._currentFileName = this._getFileName();
            this._current = Path.join(pathSettings.LOGS_FOLDER, this._currentFileName);
            this._fileManager.save('', this._current);
            this._updateRegister((new Date()).getTime(), -1, 0);
        }
    }

}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Monitor
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const MONITOR_SETTINGS = {
    RESTART_ON_ERROR: 5 * 1000, //ms
    RESTART_ON_CLOSE: 5 * 1000 //ms
};

class Monitor {

    constructor(){
        this._settingManager    = new SettingsManager();
        this._storingManager    = new StoringManager(null);
        this._fileManager       = new FileManager();
        this._settings          = null;
        this._port              = null;
        this._spawn             = null;
        this._onData            = this._onData.bind(this);
        this._onError           = this._onError.bind(this);
        this._onClose           = this._onClose.bind(this);
        this._restartTimer      = -1;
        this._ready             = false;
        this._check();
        this._reloadSettings();
        this.start();
        logger.info(`is created.`);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Common
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    start() {
        if (!this._isReady()) {
            return this._getInitError();
        }
        this._timerDrop();
        if (this._settings.port !== '') {
            return this.startPort();
        }
        if (this._settings.command !== '') {
            return this.startSpawn();
        }
    }

    stop() {
        if (!this._isReady()) {
            return this._getInitError();
        }
        if (this._port !== null) {
            return this.stopPort();
        }
        if (this._spawn !== null) {
            return this.stopSpawn();
        }
    }

    _bind(dest){
        dest.on(dest.EVENTS.ON_DATA,    this._onData);
        dest.on(dest.EVENTS.ON_CLOSE,   this._onClose);
        dest.on(dest.EVENTS.ON_ERROR,   this._onError);
    }

    _unbind(dest){
        dest.removeAllListeners(dest.EVENTS.ON_DATA);
        dest.removeAllListeners(dest.EVENTS.ON_CLOSE);
        dest.removeAllListeners(dest.EVENTS.ON_ERROR);
    }

    _check(){
        this._ready = this._storingManager.checkFolders();
    }

    _isReady(){
        return this._ready instanceof Error ? false : true;
    }

    _getInitError(){
        return this._ready instanceof Error ? this._ready : null;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Restarting
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _timerRestart(delay){
        if (this._restartTimer === -1){
            setTimeout(this.start.bind(this), delay);
        }
    }

    _timerDrop(){
        if (this._restartTimer !== -1) {
            clearTimeout(this._restartTimer);
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Spawn
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    startSpawn(){
        if (this._settings.command === '') {
            return logger.warning(`No command for process defined.`);
        }
        if (this._spawn !== null){
            return logger.warning(`Cannot start process, because it's already started.`);
        }
        this._spawn = new SpawnProcess(this._settings.command, this._settings.path);
        this._bind(this._spawn);
        this._spawn.open();
    }

    stopSpawn(){
        if (this._spawn === null){
            return logger.warning(`Cannot open port, because it's already closed.`);
        }
        this._unbind(this._spawn);
        this._spawn.close();
        this._spawn = null;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Port
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    startPort() {
        if (this._settings.port === '') {
            return logger.warning(`No ports setup.`);
        }
        if (this._port !== null){
            return logger.warning(`Cannot open port, because it's already opened.`);
        }
        this._port = new Port(this._settings.port, this._settings.portSettings);
        this._bind(this._port);
        this._port.open();
    }

    stopPort() {
        if (this._port === null){
            return logger.warning(`Cannot open port, because it's already closed.`);
        }
        this._unbind(this._port);
        this._port.close();
        this._port = null;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Data
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _onData(str){
        this._storingManager.add(str);
    }

    _onClose(){
        this.stop();
        this._timerRestart(this._settings.timeoutOnClose);
    }

    _onError(error){
        this.stop();
        this._timerRestart(this._settings.timeoutOnError);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Settings
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _updateSettings(settings){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this._settings = settings;
        this._settings.maxFilesCount <= 0 ? 1 : this._settings.maxFilesCount;
        this._settings.maxFileSizeMB <= 0 ? 1 : this._settings.maxFileSizeMB;
        this._settings.timeoutOnError <= 0 ? 5000 : this._settings.timeoutOnError;
        this._settings.timeoutOnClose <= 0 ? 1000 : this._settings.timeoutOnClose;
        this._settingManager.save(settings);
        this._storingManager.updateSettings(this._settings);
    }

    _reloadSettings(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this._settings = this._settingManager.load();
        this._storingManager.updateSettings(this._settings);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Public API
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    setSettings(settings){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this._updateSettings(settings);
        this.restart();
        return true;
    }

    getFilesData(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        return this._storingManager.getFilesData();
    }

    clearLogs(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this.stop();
        this._storingManager.removeLogsFiles();
        this.start();
        return true;
    }

    restart(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this.stop();
        this._reloadSettings();
        this.start();
        return true;
    }

    stopAndClear(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this.stopPort();
        this._storingManager.removeLogsFiles();
        return true;
    }

    getSettings(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this._reloadSettings();
        return Object.assign({}, this._settings);
    }

    dropSettings(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        this._settingManager.reset();
        this._reloadSettings();
        return true;
    }

    getState(){
        if (!this._isReady()) {
            return this._getInitError();
        }
        return {
            active  : this._port    !== null ? true : (this._spawn !== null ? true : false),
            port    : this._port    !== null ? this._port.getPort()     : '',
            spawn   : this._spawn   !== null ? this._spawn.getAlias()   : ''
        };
    }

    getFileContent(fileName){
        if (!this._isReady()) {
            return this._getInitError();
        }
        return this._storingManager.getFileContent(fileName);
    }

    getAllFilesContent(callback){
        if (!this._isReady()) {
            return callback(null, this._getInitError());
        }
        this._storingManager.getAllFilesContent()
            .then((file) => {
                callback(file, null);
            })
            .catch((error) => {
                callback(null, error);
            });
    }

    getMatches(reg, search){
        if (!this._isReady()) {
            return this._getInitError();
        }
        return this._storingManager.getMatches(reg, search);
    }

}

module.exports = (new Monitor());

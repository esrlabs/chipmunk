const logger        = new (require('./tools.logger'))('ServiceProcessStream');
const Events        = require('events');
const Path          = require('path');
const SerialPort    = require('serialport');

const DEFAULT_SETTINGS = {
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
        this.maxFileSizeMB  = typeof settings.maxFileSizeMB === 'number' ? (settings.maxFileSizeMB >= 1     ? settings.maxFileSizeMB    : DEFAULT_SETTINGS.maxFileSizeMB)   : DEFAULT_SETTINGS.maxFileSizeMB;
        this.maxFilesCount  = typeof settings.maxFilesCount === 'number' ? (settings.maxFilesCount >= 1     ? settings.maxFilesCount    : DEFAULT_SETTINGS.maxFilesCount)   : DEFAULT_SETTINGS.maxFilesCount;
        this.port           = typeof settings.port          === 'string' ? (settings.port.trim() !== ''     ? settings.port             : DEFAULT_SETTINGS.port)            : DEFAULT_SETTINGS.port;
        this.portSettings   = typeof settings.portSettings  === 'object' ? (settings.portSettings !== null  ? settings.portSettings     : DEFAULT_SETTINGS.portSettings)    : DEFAULT_SETTINGS.portSettings;
        this.command        = typeof settings.command       === 'string' ? (settings.command.trim() !== ''  ? settings.command          : DEFAULT_SETTINGS.command)         : DEFAULT_SETTINGS.command;
        this.path           = typeof settings.path          === 'string' ? (settings.path.trim() !== ''     ? settings.path             : DEFAULT_SETTINGS.path)            : DEFAULT_SETTINGS.path;
    }
}

const OPTIONS = {
    SETTINGS_FILE: Path.resolve('./logs/settings.json'),
    LOGS_FOLDER: Path.resolve('./logs/files/'),
    REGISTER_FILE: Path.resolve('./logs/register.json'),
    CHECK_FILE_SIZE_WITH_PACKAGE: 1000
};

class FileManager{
    constructor(){
        this._fs = require('fs');
    }

    load(path) {
        let result = null;
        if (typeof path === 'string' && path.trim() !== '' && this._fs.existsSync(path)) {
            try {
                result = this._fs.readFileSync(path);
                if (!(result instanceof Buffer)) {
                    logger.debug(`Error during reading a file "${path}". Expected type of content <Buffer>. Gotten type is <${(typeof result)}>.`);
                    result = null;
                }
            } catch (error) {
                logger.debug(`Error during reading a file "${path}". Error: ${error.message}.`);
            }
        } else {
            logger.debug(`file "${path}" is not found.`);
        }
        return result;
    }

    append(str, dest){
        if (typeof str === 'string' && str.trim() !== '' && typeof dest === 'string' && dest.trim() !== '' && this._fs.existsSync(dest)) {
            try {
                this._fs.appendFileSync(dest, str);
            } catch (error) {
                logger.debug(`Error during writting a file "${dest}". Error: ${error.message}.`);
            }
        } else {
            logger.debug(`file "${dest}" is not found.`);
        }
    }

    save(str, dest) {
        if (typeof str === 'string' && typeof dest === 'string' && dest.trim() !== '') {
            try {
                this._fs.writeFileSync(dest, str);
            } catch (error) {
                logger.debug(`Error during writting a file "${dest}". Error: ${error.message}.`);
            }
        } else {
            logger.debug(`file "${dest}" is not found.`);
        }
    }

    getSize(dest){
        if (typeof dest === 'string' && dest.trim() !== '' && this._fs.existsSync(dest)){
            let stats = this._fs.statSync(dest);
            return stats.size;
        }
        return -1;
    }

    getListOfFile(path){
        let list = [];
        if (this._fs.existsSync(path)) {
            this._fs.readdirSync(path).forEach((file) => {
                if (~file.search(/.logs$/i)) {
                    list.push(file);
                }
            });
        } else {
            logger.debug(`Wrong path "${path}".`);
        }
        return list;
    }

    deleteFile(path){
        if (this._fs.existsSync(path)) {
            this._fs.unlinkSync(path);
        }
    }

    bufferToJSON(buffer){
        buffer = this.decodeBuffer(buffer);
        if (buffer === null) {
            return null;
        }
        try {
            buffer = JSON.parse(buffer);
        } catch (e) {
            buffer = null;
        }
        return buffer;
    }

    decodeBuffer(buffer){
        if (!(buffer instanceof Buffer)){
            return null;
        }
        return buffer.toString('utf8');
    }
}

class SettingsManager {

    constructor(){
        this._fileManager   = new FileManager();
    }

    load(){
        let loadedSetting = this._fileManager.load(OPTIONS.SETTINGS_FILE);
        loadedSetting = this._fileManager.bufferToJSON(loadedSetting);
        return loadedSetting !== null ? loadedSetting : (new Settings());
    }

    save(settings){
        this._fileManager.save(JSON.stringify(settings), OPTIONS.SETTINGS_FILE);
    }

    reset() {
        this._fileManager.deleteFile(OPTIONS.SETTINGS_FILE);
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
        this.GUID           = (require('guid')).raw();
        this.port           = port;
        this.settings       = settings;
        settings.autoOpen   = false;
        this.instance       = null;
        this.EVENTS         = {
            ON_DATA : Symbol(),
            ON_ERROR: Symbol(),
            ON_CLOSE: Symbol()
        };
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
        process.on('exit', this.close.bind(this));
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
        if (typeof this.path !== 'string' || this.path.trim() === '') {
            this.path = this.setPath('');
        } else {
            this.path = this.setPath(this.path);
        }
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
            logger.info(`Removing logs file: ${Path.join(OPTIONS.LOGS_FOLDER, file)}.`);
            this._fileManager.deleteFile(Path.join(OPTIONS.LOGS_FOLDER, file));
        });
        this._resetCurrent();
        this._clearRegister();
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
        let files = this._getFileList();
        if (!(files instanceof Array)) {
            return new Error(`No any files found.`);
        }
        let content = [];
        files.forEach((fileName) => {
            content.push(this._getFileContent(fileName));
        });
        return content.join('\n');
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
            return -1;
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
                let lines   = content.split(/[\n\r]/gi);
                let total   = -1;
                let indexes = {};
                lines.forEach((line, index) => {
                    total += line.length + 1;
                    indexes[total] = index;
                });
                let matchesIndexes = [];
                let matches = [];
                do {
                    let match = regExp.exec(content);
                    let index = null;
                    if (match !== null) {
                        index = match.index;
                        matchesIndexes.push(index);
                        index = getIndex(indexes, index);
                        if (lines[index.index] !== void 0) {
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
        if (this._current === null) {
            this._resetCurrent();
            this._updateRegister(this._currentFileName, (new Date()).getTime(), -1);
        }
        let size = this._fileManager.getSize(this._current);
        if (size === -1) {
            //file doesn't exist
            this._updateRegister(this._currentFileName, (new Date()).getTime(), -1);
            this._fileManager.save('', this._current);
        } else if (size >= this._settings.maxFileSizeMB * 1024 * 1024) {
            //size of file is too big
            this._updateRegister(this._currentFileName, -1, (new Date()).getTime());
            this._resetCurrent();
        }
    }

    _getFileList(){
        return this._fileManager.getListOfFile(OPTIONS.LOGS_FOLDER);
    }

    _getFilesData(){
        let data = this._fileManager.load(OPTIONS.REGISTER_FILE);
        data = this._fileManager.bufferToJSON(data);
        return data !== null ? data : {};
    }

    _getFileContent(fileName){
        let content = this._fileManager.load(Path.join(OPTIONS.LOGS_FOLDER, fileName));
        return this._fileManager.decodeBuffer(content);
    }

    _updateRegister(fileName, opened, closed){
        let register = this._fileManager.bufferToJSON(this._fileManager.load(OPTIONS.REGISTER_FILE));
        if (register === null) {
            register = {};
        }
        if (register[fileName] === void 0) {
            register[fileName] = {
                opened: -1,
                closed: -1
            };
        }
        opened !== -1 && (register[fileName].opened = opened);
        closed !== -1 && (register[fileName].closed = closed);
        this._fileManager.save(JSON.stringify(register), OPTIONS.REGISTER_FILE);
    }

    _clearRegister(){
        this._fileManager.deleteFile(OPTIONS.REGISTER_FILE);
    }

    _resetCurrent(){
        this._currentFileName = this._getFileName();
        this._current = Path.join(OPTIONS.LOGS_FOLDER, this._currentFileName);
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
        this._reloadSettings();
        this.start();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Common
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    start() {
        this._timerDrop();
        if (this._settings.port !== '') {
            return this.startPort();
        }
        if (this._settings.command !== '') {
            return this.startSpawn();
        }
    }

    stop() {
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
        this._timerRestart(MONITOR_SETTINGS.RESTART_ON_CLOSE);
    }

    _onError(error){
        this.stop();
        this._timerRestart(MONITOR_SETTINGS.RESTART_ON_ERROR);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Settings
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    _updateSettings(settings){
        this._settings = settings;
        this._settingManager.save(settings);
        this._storingManager.updateSettings(this._settings);
    }

    _reloadSettings(){
        this._settings = this._settingManager.load();
        this._storingManager.updateSettings(this._settings);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Public API
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    setSettings(settings){
        this._updateSettings(settings);
        this.restart();
        return true;
    }

    getFilesData(){
        return this._storingManager.getFilesData();
    }

    clearLogs(){
        this.stop();
        this._storingManager.removeLogsFiles();
        this.start();
        return true;
    }

    restart(){
        this.stop();
        this._reloadSettings();
        this.start();
        return true;
    }

    stopAndClear(){
        this.stopPort();
        this._storingManager.removeLogsFiles();
        return true;
    }

    getSettings(){
        this._reloadSettings();
        return Object.assign({}, this._settings);
    }

    dropSettings(){
        this._settingManager.reset();
        this._reloadSettings();
        return true;
    }

    getState(){
        return {
            active  : this._port    !== null ? true : (this._spawn !== null ? true : false),
            port    : this._port    !== null ? this._port.getPort()     : '',
            spawn   : this._spawn   !== null ? this._spawn.getAlias()   : ''
        };
    }

    getFileContent(fileName){
        return this._storingManager.getFileContent(fileName);
    }

    getAllFilesContent(){
        return this._storingManager.getAllFilesContent();
    }

    getMatches(reg, search){
        return this._storingManager.getMatches(reg, search);
    }

}

module.exports = (new Monitor());

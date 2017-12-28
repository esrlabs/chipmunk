const logger        = new (require('./tools.logger'))('ServiceProcessStream');
const Events        = require('events');
const Path          = require('path');
const SerialPort    = require('serialport');

const DEFAULT_SETTINGS = {
    maxFileSizeMB: 100,
    maxFilesCount: 10,
    port: '',
    portSettings: {}
};

class Settings{

    constructor(settings){
        settings = typeof settings === 'object' ? (settings !== null ? settings : {}) : {};
        this.maxFileSizeMB  = typeof settings.maxFileSizeMB === 'number' ? (settings.maxFileSizeMB >= 1 ? settings.maxFileSizeMB : DEFAULT_SETTINGS.maxFileSizeMB) : DEFAULT_SETTINGS.maxFileSizeMB;
        this.maxFilesCount  = typeof settings.maxFilesCount === 'number' ? (settings.maxFilesCount >= 1 ? settings.maxFilesCount : DEFAULT_SETTINGS.maxFilesCount) : DEFAULT_SETTINGS.maxFilesCount;
        this.port           = typeof settings.port          === 'string' ? (settings.port.trim() !== '' ? settings.port : DEFAULT_SETTINGS.port) : DEFAULT_SETTINGS.port;
        this.portSettings   = typeof settings.portSettings  === 'object' ? (settings.portSettings !== null ? settings.portSettings : DEFAULT_SETTINGS.portSettings) : DEFAULT_SETTINGS.portSettings;
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
        if (typeof str === 'string' && str.trim() !== '' && typeof dest === 'string' && dest.trim() !== '') {
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
            ON_DATA: Symbol(),
            ON_ERROR: Symbol()
        };
    }

    open(callback = () => {}){
        try {
            this.instance = new SerialPort(this.port, this.settings);
            this.instance.open((error) => {
                if (error) {
                    logger.error('[session: ' + this.GUID + ']:: Fail to open port: ' + this.port + '. Error: ' + error.message);
                    this.close(() => {});
                    callback(null, error);
                } else {
                    logger.debug('[session: ' + this.GUID + ']:: Port is opened: ' + this.port);
                    callback(this.GUID, null);
                }
            });
            //Attach events
            Object.keys(PORT_EVENTS).forEach((event)=>{
                this.instance.on(PORT_EVENTS[event], this['on' + event].bind(this));
            });
        } catch (error){
            logger.error('[session: ' + this.GUID + ']:: Fail to create port: ' + this.port + '. Error: ' + error.message);
            callback(null, error);
        }
    }

    getPort(){
        return this.port;
    }


    close(callback = () => {}){
        if (this.instance !== null) {
            try {
                this.instance.close(callback);
            } catch (error) {
                callback(error);
                logger.debug(`[session: ${this.GUID}]:: Error during closing port: ${this.port}. Error: ${error.message}.`);
            }
            this.instance = null;
            logger.debug('[session: ' + this.GUID + ']:: Port is closed: ' + this.port);
        } else {
            callback();
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


class Monitor {

    constructor(){
        this._settingManager    = new SettingsManager();
        this._settings          = null;
        this._fileManager       = new FileManager();
        this._port              = null;
        this._onPortData        = this._onPortData.bind();
        this._current           = null;
        this._packages          = 0;
        this._reloadSettings();
        this.startPort();
    }

    startPort() {
        if (this._settings.port === '') {
            return logger.warning(`No ports setup.`);
        }
        if (this._port !== null){
            return logger.warning(`Cannot open port, because it's already opened.`);
        }
        this._port = new Port(this._settings.port, this._settings.portSettings);
        this._port.on(this._port.EVENTS.ON_DATA,    this._onPortData);
        this._port.on(this._port.EVENTS.ON_ERROR,   this._onPortError);
        this._port.open((result, error) => {
            if (error) {
                this.stopPort();
            }
        });
    }

    stopPort(){
        if (this._port === null){
            return logger.warning(`Cannot open port, because it's already closed.`);
        }
        this._port.removeAllListeners(this._port.EVENTS.ON_DATA);
        this._port.removeAllListeners(this._port.EVENTS.ON_ERROR);
        this._port.close();
        this._port = null;
    }

    setSettings(settings){
        this._updateSettings(settings);
        this.restart();
        return true;
    }

    restart(){
        this.stopPort();
        this._reloadSettings();
        this.startPort();
        return true;
    }

    getFilesData(){
        return {
            list    : this._getFileList(),
            register: this._getFilesData()
        };
    }

    stopAndClear(){
        this.stopPort();
        this._removeLogsFiles();
    }

    clearLogs(){
        this.stopPort();
        this._removeLogsFiles();
        this.startPort();
    }

    _removeLogsFiles(){
        let files = this._getFileList();
        files instanceof Array && files.forEach((file) => {
            logger.info(`Removing logs file: ${Path.join(OPTIONS.LOGS_FOLDER, file)}.`)
            this._fileManager.deleteFile(Path.join(OPTIONS.LOGS_FOLDER, file));
        });
    }

    getSettings(){
        this._reloadSettings();
        return Object.assign({}, this._settings);
    }

    getState(){
        return {
            active  : this._port !== null,
            port    : this._port !== null ? this._port.getPort() : ''
        };
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

    _updateSettings(settings){
        this._settings = settings;
        this._settingManager.save(settings);
    }

    _reloadSettings(){
        this._settings = this._settingManager.load();
    }

    _getFileName(){
        let date = new Date();
        return date.getTime() + '.logs';
    }

    _checkFile(){
        if (this._current === null) {
            this._current = Path.join(OPTIONS.LOGS_FOLDER, this._getFileName());
            this._updateRegister(this._current, (new Date()).getTime(), -1);
        }
        if (this._packages > OPTIONS.CHECK_FILE_SIZE_WITH_PACKAGE){
            let size = this._fileManager.getSize(this._current);
            if (size >= this._settings.maxFileSizeMB * 1024 * 1024) {
                this._updateRegister(this._current, -1, (new Date()).getTime());
                this._current = Path.join(OPTIONS.LOGS_FOLDER, this._getFileName());
            }
        }
    }

    _onPortData(str){
        this._checkFile();
        this._fileManager.append(str, Path.join(OPTIONS.LOGS_FOLDER, this._current));
    }

    _onPortError(error){
        this.stopPort();
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
        let register = this._fileManager.load(OPTIONS.REGISTER_FILE);
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

}

module.exports = (new Monitor());

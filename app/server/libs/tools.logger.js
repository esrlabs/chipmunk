const LEVELS = {
    DEBUG:      'debug',
    VERBOSE:    'verbose',
    INFO:       'info',
    WARNING:    'warning',
    ERROR:      'error'
};

const COLORS = {
    RED:        '\033[0;31m',
    YELLOW:     '\033[0;33m',
    NC:         '\033[0m',
    GREEN:      '\033[0;32m',
    LIGHT_GRAY: '\033[0;37m',
    DARK_GRAY:  '\033[0;90m'

};

const FileManager = require('./tools.filemanager');
const Path = require('path');

class PathsSettings {

    constructor(){
        this.os                             = require('os');
        this.ROOT                           = Path.resolve(this.os.homedir() + '/logviewer');
        this.LOGS_FILE                      = '';
        this.generate();
    }

    generate(){
        this.LOGS_FILE                      = Path.resolve(this.ROOT + '/service.log');
    }
}

class Logger {

    constructor(signature, noFSRecording){
        this.signature      = signature;
        this._fileManager   = new FileManager(true);
        this._paths         = new PathsSettings();
        this._FSReady       = false;
        this._noFSRecording = typeof noFSRecording === 'boolean' ? noFSRecording : false;
        this._initFSStorage();
    }

    _checkFolders(){
        let error = null;
        error = error !== null ? error : this._fileManager.createFolder(this._paths.ROOT);
        return error;
    }

    _initFSStorage(){
        if (this._checkFolders() === null || this._noFSRecording) {
            if (!this._fileManager.isExistsSync(this._paths.LOGS_FILE)){
                this._fileManager.save('', this._paths.LOGS_FILE);
            }
            this._FSReady = true;
        } else {
            this._FSReady = false;
        }
    }

    _writeFS(message){
        this._FSReady && this._fileManager.append(message, this._paths.LOGS_FILE);
    }

    debug(message){
        return this._log(this._setColor(COLORS.GREEN, LEVELS.DEBUG), message);
    }

    verbose(message){
        return this._log(this._setColor(COLORS.DARK_GRAY, LEVELS.VERBOSE), message);
    }

    info(message){
        return this._log(this._setColor(COLORS.LIGHT_GRAY, LEVELS.INFO), message);
    }

    warning(message){
        return this._log(this._setColor(COLORS.YELLOW, LEVELS.WARNING), message);
    }

    error(message){
        return this._log(this._setColor(COLORS.RED, LEVELS.ERROR), message);
    }

    warn(message){
        return this.warning(message);
    }

    silly(message){
        return this.verbose(message);
    }

    log(message){
        return this.info(message);
    }

    _setColor(color, message){
        return color + message + COLORS.NC;
    }

    _getTimeMark(){
        function fill(src, count) {
            return (src + '').length < count ? ('0'.repeat(count - (src + '').length) + src) : (src + '');
        }
        let date = new Date();
        return `${fill(date.getMonth() + 1, 2)}.${fill(date.getDate(), 2)} ${fill(date.getHours(), 2)}:${fill(date.getMinutes(), 2)}:${fill(date.getSeconds(), 2)}.${fill(date.getMilliseconds(), 3)}`;
    }

    _log(level, message){
        message = `[${this.signature}][${level}]: ${message}`;
        console.log(`[${this._getTimeMark()}]${message}`);
        this._writeFS(`[${this._getTimeMark()}]${message}\n`);
        return message;
    }
}

module.exports = Logger;
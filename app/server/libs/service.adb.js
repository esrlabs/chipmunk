const logger        = new (require('./tools.logger'))('ServiceADBStream');
const
    spawn           = require('child_process').spawn,
    ServerEmitter   = require('./server.events'),
    StringDecoder   = require('string_decoder').StringDecoder;

const LOGCAT_STREAM_OPTIONS = {
    ENTRIES_PER_PACKAGE     : 500,
    DURATION_PER_DATA_EVENT : 200 //ms. If duration between on Data event less than here, data will be included into one package
};

const PLATFORMS = {
    DARWIN    : 'darwin',
    LINUX     : 'linux',
    WIN32     : 'win32'
};

class SpawnProcess {

    constructor() {
        this.error      = null;
        this.spawn      = null;
        this.adbAlias   = '';
        this.getAdbAlias();
        process.on('exit', this.destroy.bind(this));
    }

    getAdbAlias(){
        this.adbAlias = 'adb';
        if (process.platform === PLATFORMS.WIN32) {
            this.adbAlias = 'adb.exe';
        }
    }

    getPath(path){
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

    getProcess(path, reset = false) {
        if (this.spawn !== null) {
            return this.spawn;
        }
        path    = this.getPath(path);
        reset   = typeof reset === 'boolean' ? reset : false;
        try {
            //Clear before
            reset && spawn(this.adbAlias, ['logcat', '-c'], {
                env: {
                    PATH: path
                }
            });
            //Set buffer size
            spawn(this.adbAlias, ['logcat', '-G', '1m'], {
                env: {
                    PATH: path
                }
            });
            //Start
            this.spawn = spawn(this.adbAlias, ['logcat', '-b', 'all', '-v', 'color'], {
                env: {
                    PATH: path
                }
            }).on('error', (error) => {
                this.error = new Error(logger.error(`[ADB_SPAWN_01] Error to execute adb: ${error.message}. PATH=${path}`));
                this.spawn = null;
            });
            this.error = null;
        } catch (error) {
            this.error = error;
            this.spawn = null;
        }
        if (this.spawn !== null && (typeof this.spawn.pid !== 'number' || this.spawn.pid <= 0)){
            this.error = new Error(logger.error(`[ADB_SPAWN_01] Fail to execute adb. PATH=${path}`));
            this.spawn = null;
        }
        return this.spawn;
    }

    getError() {
        return this.error;
    }

    destroy() {
        this.spawn !== null && this.spawn.kill();
        this.spawn  = null;
    }
}

class LogcatStream {

    constructor(clientGUID, settings, stdout) {
        this.clientGUID     = clientGUID;
        this.GUID           = (require('guid')).raw();
        this.stdout         = stdout;
        this.onData         = this.onData.bind(this);
        this.decoder        = new StringDecoder('utf8');
        this.onBufferTimer  = this.onBufferTimer.bind(this);
        this.resetBuffer();
        this.setSettings(settings);
    }

    setSettings(settings) {
        settings        = typeof settings === 'object' ? (settings !== null ? settings : {}) : {};
        this.settings   = {
            pid     : typeof settings.pid === 'string' ? (settings.pid.trim() !== '' ? settings.pid : null) : null,
            tid     : typeof settings.tid === 'string' ? (settings.tid.trim() !== '' ? settings.tid : null) : null,
            tags    : settings.tags instanceof Array ? settings.tags : null,
            reset   : typeof settings.reset === 'boolean' ? settings.reset : false
        };
        this.settings.tags instanceof Array && (this.settings.tags = this.settings.tags.filter((tag) => {
            return typeof tag === 'string' ? (tag.trim() !== '') : false;
        }).map((tag)=>{
            return tag.toLowerCase();
        }));
        logger.debug(`settings of client ${this.clientGUID} was updated.`);
    }

    open() {
        this.stdout.on('data', this.onData);
        return true;
    }

    close(){
        this.destroy();
    }

    destroy() {
        this.stdout.removeListener('data', this.onData);
        this.clientGUID = null;
    }

    resetBuffer() {
        this.buffer     = {
            parts       : 0,
            entries     : [],
            timer       : -1,
            rest        : ''
        };
    }

    resetBufferTimer(){
        if (this.buffer.timer !== -1){
            clearTimeout(this.buffer.timer);
        }
    }

    setBufferTimer(){
        this.resetBufferTimer();
        this.buffer.timer = setTimeout(this.onBufferTimer, LOGCAT_STREAM_OPTIONS.DURATION_PER_DATA_EVENT);
    }

    addToBuffer(message) {
        let entries = this.parseMessages(message);
        if (entries !== null && entries.length > 0){
            this.resetBufferTimer();
            this.buffer.entries.push(...entries);
            if (this.buffer.entries.length >= LOGCAT_STREAM_OPTIONS.ENTRIES_PER_PACKAGE) {
                this.onBufferTimer();
            } else {
                this.setBufferTimer();
            }
        }
    }

    decodeBuffer(message){
        try {
            return this.decoder.write(message);
        } catch (error){
            return null;
        }
    }

    onBufferTimer(){
        const outgoingWSCommands = require('./websocket.commands.processor.js');
        this.clientGUID !== null && ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, this.clientGUID, outgoingWSCommands.COMMANDS.ADBLogcatData, {
            stream      : this.GUID,
            entries     : this.buffer.entries.filter(x=>true)
        });
        this.resetBufferTimer();
        this.resetBuffer();
    }

    filter(entry) {
        let result = true;
        this.clientGUID === null && (result = false);
        this.settings.pid   !== null && (this.settings.pid != entry.pid && (result = false));
        this.settings.tid   !== null && (this.settings.tid != entry.tid && (result = false));
        if (this.settings.tags !== null && typeof entry.tag === 'string' && entry.tag.trim() !== '') {
            this.settings.tags.indexOf(entry.tag.toLowerCase()) === -1 && (result = false);
        }
        return result;
    }

    getGUID(){
        return this.GUID;
    }

    parseMessages(data){
        let message = this.decodeBuffer(data);
        if (typeof message !== 'string'){
            return null;
        }
        //Add rest from previous
        message = this.buffer.rest + message;
        //Split messages
        let entries = message.split(/[\n\r]/gi);
        //Exclude rest (not finished message)
        if (message.search(/\n$/gi) === -1){
            this.buffer.rest = entries[entries.length - 1];
            entries.splice(-1, 1);
        } else {
            this.buffer.rest = '';
        }
        //Filter empty messages
        entries = entries.filter((message) => {
            return message.trim() !== '';
        });
        //Parsing messages
        entries = entries.map((message) => {
            return this.parseMessage(message);
        });
        //Filter message
        entries = entries.filter((entry) => {
            return this.filter(entry);
        });
        return entries;
    }

    parseMessage(str){
        const date      = /^[\d-]* [\d:\.]*/gi;
        const spaces    = /^[\s]*/gi;
        const pid       = /^[\d]*/gi;
        const tid       = /^[\d]*/gi;
        const tag       = /^\w/gi;
        let result = {
            date    : '',
            pid     : '',
            tid     : '',
            tag     : '',
            message : '',
            original: str
        };
        if (typeof str !== 'string') {
            return null;
        }
        let match = str.match(date);
        match instanceof Array && (match.length === 1 && (result.date = match[0]));
        str = str.replace(date, '').replace(spaces, '');
        match = str.match(pid);
        match instanceof Array && (match.length === 1 && (result.pid = match[0]));
        str = str.replace(pid, '').replace(spaces, '');
        match = str.match(tid);
        match instanceof Array && (match.length === 1 && (result.tid = match[0]));
        str = str.replace(tid, '').replace(spaces, '');
        match = str.match(tag);
        match instanceof Array && (match.length === 1 && (result.tag = match[0]));
        str = str.replace(tag, '').replace(spaces, '');
        result.message = str;
        return result;
    }

    onData(data) {
        this.addToBuffer(data);
    }

}

class ADBStream {

    constructor(){
        this.streams            = {};
        this.onClientDisconnect = this.onClientDisconnect.bind(this);
        this.spawnProcess       = new SpawnProcess();
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED, this.onClientDisconnect );
    }

    open(clientGUID, settings, callback){
        let spawn = this.spawnProcess.getProcess(
            settings !== null ? (typeof settings === 'object' ? settings.path   : null) : null,
            settings !== null ? (typeof settings === 'object' ? settings.reset  : null) : null
        );
        if (spawn === null) {
            return callback(false, new Error(logger.error(`[client ${clientGUID} cannot open logcat stream. Error: ${this.spawnProcess.getError().message}`)));
        }
        if (typeof clientGUID !== 'string' || clientGUID.trim() === ''){

            return callback(false, new Error(logger.error(`[clientGUID isn't defined or defined incorrectly.`)));
        }
        if (this.streams[clientGUID] !== void 0) {
            return callback(false, new Error(logger.error(`client ${clientGUID} already is listening logcat stream.`)));
        }
        let stream  = new LogcatStream(clientGUID, settings, spawn.stdout);
        let error   = stream.open();
        if (error !== true){
            return callback(false, new Error(logger.error(`client ${clientGUID} cannot open logcat stream. Error: ${error.message}`)));
        }
        this.streams[clientGUID] = stream;
        logger.debug(`client ${clientGUID} started listen logcat stream.`);
        callback(stream.getGUID(), null);
    }

    setSettings(clientGUID, settings, callback){
        if (this.streams[clientGUID] === void 0) {
            return callback(false, new Error(logger.error(`client ${clientGUID} isn't listening logcat stream.`)));
        }
        this.streams[clientGUID].setSettings(settings);
        callback(true, null);
    }

    close(clientGUID){
        if (this.streams[clientGUID] !== void 0){
            this.streams[clientGUID].destroy();
            delete this.streams[clientGUID];
            Object.keys(this.streams).length === 0 && this.spawnProcess.destroy();
            logger.debug(`client ${clientGUID} stopped listen logcat stream.`);
        }
    }

    onClientDisconnect(connection, clientGUID){
        this.close(clientGUID);
    }

}

let adbStream = new ADBStream();

module.exports = adbStream;


const logger        = new (require('./tools.logger'))('ServiceProcessStream');
const
    spawn           = require('child_process').spawn,
    ServerEmitter   = require('./server.events'),
    StringDecoder   = require('string_decoder').StringDecoder;
    EventEmitter    = require('events').EventEmitter;

const STREAM_OPTIONS = {
    ENTRIES_PER_PACKAGE     : 500,
    DURATION_PER_DATA_EVENT : 200 //ms. If duration between on Data event less than here, data will be included into one package
};

const PLATFORMS = {
    DARWIN    : 'darwin',
    LINUX     : 'linux',
    WIN32     : 'win32'
};

const ERRORS = {
    EXECUTING_ERROR : 'EXECUTING_ERROR'
};

class SpawnProcess extends EventEmitter{

    constructor(alias, parameters, path) {
        super();
        this.error      = null;
        this.spawn      = null;
        this.alias      = null;
        this.parameters = null;
        this.path       = null;
        if (this.validate(alias, parameters, path)) {
            this.startProcess();
            process.on('exit', this.destroy.bind(this));
        }
    }

    validate(alias, parameters, path){
        let errors = [];
        if (typeof alias !== 'string' || alias.trim() === '') {
            errors = `Expect alias (command) will be not empty {string}, but format is: ${(typeof alias)}.`;
        } else {
            this.alias = this.getAlias(alias);
        }
        if (typeof path !== 'string' || path.trim() === '') {
            this.path = this.getPath('');
        } else {
            this.path = this.getPath(path);
        }
        if (!(parameters instanceof Array)){
            errors = `Expect parameters will be {Array<string>}, but format is: ${(typeof parameters)}.`;
        } else {
            this.parameters = parameters.filter((param) => {
                return typeof param === 'string' ? (param.trim() !== '') : false;
            });
        }
        errors.length > 0 && (this.error = new Error(errors.join(', ')));
        return errors.length === 0;
    }

    getAlias(alias){
        if (process.platform === PLATFORMS.WIN32) {
            alias = alias + (~alias.search(/\.exe$/gi) ? '' : '.exe');
        }
        return alias;
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

    startProcess() {
        if (this.spawn !== null) {
            return this.spawn;
        }
        try {
            this.spawn = spawn(this.alias, this.parameters, {
                    env: {
                        PATH: this.path
                    }
                })
                .on('error', (error) => {
                    this.error = new Error(logger.error(`[${ERRORS.EXECUTING_ERROR}] Error to execute ${this.alias}: ${error.message}. PATH=${this.path}`));
                    this.spawn = null;
                })
                .on('close',        this.onClose.bind(this))
                .on('disconnect',   this.onClose.bind(this))
                .on('exit',         this.onClose.bind(this));
            this.error = null;
        } catch (error) {
            this.error = error;
            this.spawn = null;
        }
        if (this.spawn !== null && (typeof this.spawn.pid !== 'number' || this.spawn.pid <= 0)){
            this.error = new Error(logger.error(`[${ERRORS.EXECUTING_ERROR}] Fail to execute ${this.alias}. PATH=${this.path}`));
            this.spawn = null;
        }
        return this.spawn;
    }

    getSpawn() {
        return this.spawn;
    }

    getError() {
        return this.error;
    }

    onClose(code, signal) {
        this.emit('close');
    }

    destroy() {
        try {
            this.spawn !== null && this.spawn.kill();
            this.spawn  = null;
        } catch (error){
            this.spawn  = null;
            this.error  = error;
        }
    }
}

class Stream {

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
            keywords: settings.keywords instanceof Array ? settings.keywords : null
        };
        this.settings.keywords instanceof Array && (this.settings.keywords = this.settings.keywords.filter((keyword) => {
            return typeof keyword === 'string' ? (keyword.trim() !== '') : false;
        }).map((keyword)=>{
            return keyword.toLowerCase();
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

    destroy(forceBufferSending = true) {
        forceBufferSending && this.onBufferTimer();
        this.sendCloseNotification();
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
            this.buffer.timer = -1;
        }
    }

    setBufferTimer(){
        this.resetBufferTimer();
        this.buffer.timer = setTimeout(this.onBufferTimer, STREAM_OPTIONS.DURATION_PER_DATA_EVENT);
    }

    addToBuffer(message) {
        let entries = this.parseMessages(message);
        if (entries !== null && entries.length > 0){
            this.resetBufferTimer();
            this.buffer.entries.push(...entries);
            if (this.buffer.entries.length >= STREAM_OPTIONS.ENTRIES_PER_PACKAGE) {
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
        this.resetBufferTimer();
        const outgoingWSCommands = require('./websocket.commands.processor.js');
        this.clientGUID !== null && ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, this.clientGUID, outgoingWSCommands.COMMANDS.TermProcessData, {
            stream      : this.GUID,
            entries     : this.buffer.entries.filter(x=>true)
        });
        this.resetBuffer();
    }

    sendCloseNotification(){
        const outgoingWSCommands = require('./websocket.commands.processor.js');
        this.clientGUID !== null && ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, this.clientGUID, outgoingWSCommands.COMMANDS.TermProcessClosed, {
            stream      : this.GUID
        });
    }

    filter(entry) {
        let result = true;
        this.clientGUID === null && (result = false);
        if (this.settings.keywords !== null && typeof entry.original === 'string' && entry.original.trim() !== '') {
            this.settings.keywords.length > 0 && (result = false);
            this.settings.keywords.forEach((keyword) => {
                if (entry.original.search(new RegExp(keyword, 'gi')) !== -1) {
                    result = true;
                }
            });
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
        let entries = message.split('\n');
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
        let result = {
            original: str
        };
        if (typeof str !== 'string') {
            return null;
        }
        return result;
    }

    onData(data) {
        this.addToBuffer(data);
    }

}

class Controller {

    constructor(){
        this.streams            = {};
        this.onClientDisconnect = this.onClientDisconnect.bind(this);
        this.processes          = [];
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED, this.onClientDisconnect );
    }

    getProcess(clientGUID, settings) {
        if (this.processes[clientGUID] !== void 0) {
            this.closeProcess(clientGUID);
        }
        let process = new SpawnProcess(settings.alias, settings.parameters, settings.path);
        if (process.getError() !== null) {
            process.destroy();
            return process.getError();
        }
        process.on('close', (event)=>{
            this.close(clientGUID);
        });
        this.processes[clientGUID] = process;
        return process;
    }

    closeProcess(clientGUID){
        if (this.processes[clientGUID] === void 0) {
            return false;
        }
        this.processes[clientGUID].destroy();
        delete this.processes[clientGUID];
        return true;
    }

    getStream(clientGUID, settings, spawn){
        if (this.processes[clientGUID] === void 0) {
            return new Error(`No process for client ${clientGUID}`);
        }
        if (this.streams[clientGUID] !== void 0) {
            this.closeStream(clientGUID);
        }
        let stream  = new Stream(clientGUID, settings, spawn.stdout);
        let error   = stream.open();
        if (error !== true){
            stream.destroy();
            return error;
        }
        this.streams[clientGUID] = stream;
        return stream;
    }

    closeStream(clientGUID){
        if (this.streams[clientGUID] === void 0){
            return false;
        }
        this.streams[clientGUID].destroy(true);
        delete this.streams[clientGUID];
        logger.debug(`client ${clientGUID} stopped listen stream.`);
        return true;
    }

    open(clientGUID, settings, callback){
        settings = typeof settings === 'object' ? (settings !== null ? settings : {}) : {};
        if (typeof clientGUID !== 'string' || clientGUID.trim() === ''){
            return callback(false, new Error(logger.error(`[clientGUID] isn't defined or defined incorrectly.`)));
        }
        if (this.streams[clientGUID] !== void 0) {
            return callback(false, new Error(logger.error(`client ${clientGUID} already is listening stream.`)));
        }
        let process = this.getProcess(clientGUID, settings);
        if (process instanceof Error) {
            return callback(false, new Error(logger.error(`Cannot start process due error: ${process.message}.`)));
        }
        let stream  = this.getStream(clientGUID, settings, process.getSpawn());
        if (stream instanceof Error){
            return callback(false, new Error(logger.error(`client ${clientGUID} cannot open stream. Error: ${stream.message}`)));
        }
        logger.debug(`client ${clientGUID} started listen stream: ${settings.alias}.`);
        callback(stream.getGUID(), null);
    }

    close(clientGUID){
        this.closeStream(clientGUID);
        this.closeProcess(clientGUID);
    }

    onClientDisconnect(connection, clientGUID){
        this.close(clientGUID);
    }

}

module.exports = (new Controller());


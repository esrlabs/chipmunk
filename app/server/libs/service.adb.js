const logger        = new (require('./tools.logger'))('ServiceADBStream');
const
    ServerEmitter       = require('./server.events'),
    StringDecoder       = require('string_decoder').StringDecoder,
    EventEmitter        = require('events').EventEmitter,
    SpawnWrapper        = require('./tools.spawn'),
    StringTimerBuffer   = require('./tools.buffers').StringTimerBuffer;

const STREAM_BUFFER_OPTIONS = {
    LENGTH      : 300000,
    DURATION    : 200 //ms. If duration between on Data event less than here, data will be included into one package
};

const PLATFORMS = {
    DARWIN    : 'darwin',
    LINUX     : 'linux',
    WIN32     : 'win32'
};

const OPTIONS = {
    MINIMAL_RESTART_DELAY : 2000 //ms
};

const DEFAULT_PARAMS = ['-b', 'all', '-v', 'color'];

class ADBManager {

    constructor(){

    }

    _getAdbAlias(){
        let adbAlias = 'adb';
        if (process.platform === PLATFORMS.WIN32) {
            adbAlias = 'adb.exe';
        }
        return adbAlias;
    }

    _getPath(path){
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

    _getEnv(path) {
        return Object.assign(process.env, {
            PATH: this._getPath(path)
        });
    }

    getListOfDevices(path){
        return new Promise((resolve, reject) => {
            let sw = new SpawnWrapper(true);
            sw.on(sw.EVENTS.done, (output) => {
                sw.removeAllListeners(sw.EVENTS.done);
                if (typeof output !== 'string') {
                    return resolve([]);
                }
                let devices = output.match(/^[\w\d-_]{1,}\s{2,}.*device\:[\w\d-_]{1,}/gmi);
                if (devices === null || devices.length === 0) {
                    return resolve([]);
                }
                devices = devices.map((str) => {
                    let pair = str.split(/\s{2,}/gi);
                    if (pair.length !== 2) {
                        return null;
                    }
                    const desc = {
                        ID: pair[0],
                        model: '',
                        device: '',
                        product: '',
                        usb: ''
                    };
                    [
                        { target: 'usb', reg: /device usb\:[\w\d-_]*/gi},
                        { target: 'product', reg: /product\:[\w\d-_]*/gi},
                        { target: 'model', reg: /model\:[\w\d-_]*/gi},
                        { target: 'device', reg: /device\:[\w\d-_]*/gi}
                    ].forEach((preset) => {
                        const matches = pair[1].match(preset.reg);
                        if (matches === null || matches.length !== 1){
                            return;
                        }
                        const value = matches[0].split(':');
                        if (value.length !== 2){
                            return;
                        }
                        desc[preset.target] = value[1];
                    });
                    return desc;
                }).filter((item) => {
                    return item !== null;
                });
                resolve(devices);
            });
            sw.execute(this._getAdbAlias(), ['devices', '-l'], this._getEnv(path), 3000).catch(reject);
        });
    }
}

class SpawnProcess extends EventEmitter {

    constructor() {
        super();
        this._stream        = null;
        this._started       = null;
        this._onClose       = this._onClose.bind(this);
        this._onData        = this._onData.bind(this);
        this._onError       = this._onError.bind(this);
        this._onDisconnect  = this._onDisconnect.bind(this);
        this._onExit        = this._onExit.bind(this);
        this.EVENTS         = {
            ON_DATA : Symbol(),
            ON_CLOSE: Symbol()
        };
    }

    _getAdbAlias(){
        let adbAlias = 'adb';
        if (process.platform === PLATFORMS.WIN32) {
            adbAlias = 'adb.exe';
        }
        return adbAlias;
    }

    _getPath(path){
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

    _getEnv(path) {
        return Object.assign(process.env, {
            PATH: this._getPath(path)
        });
    }

    _onError(...args){
        this._destroy();
        this.emit(this.EVENTS.ON_CLOSE, ...args);
    }

    _onClose(...args){
        this._destroy();
        this.emit(this.EVENTS.ON_CLOSE, ...args);
    }

    _onDisconnect(){
        this._destroy();
        this.emit(this.EVENTS.ON_CLOSE, ...args);
    }

    _onExit(...args){
        this._destroy();
        this.emit(this.EVENTS.ON_CLOSE, ...args);
    }

    _onData(...args){
        this.emit(this.EVENTS.ON_DATA, ...args);
    }

    _bind(){
        if (this._stream !== null){
            this._stream.on(this._stream.EVENTS.error,        this._onError);
            this._stream.on(this._stream.EVENTS.close,        this._onClose);
            this._stream.on(this._stream.EVENTS.disconnect,   this._onDisconnect);
            this._stream.on(this._stream.EVENTS.exit,         this._onExit);
            this._stream.on(this._stream.EVENTS.data,         this._onData);
        }
    }

    _unbind(){
        if (this._stream !== null){
            this._stream.removeAllListeners(this._stream.EVENTS.error);
            this._stream.removeAllListeners(this._stream.EVENTS.close);
            this._stream.removeAllListeners(this._stream.EVENTS.disconnect);
            this._stream.removeAllListeners(this._stream.EVENTS.exit);
            this._stream.removeAllListeners(this._stream.EVENTS.data);
        }
    }

    _destroy(){
        this._unbind();
        this._stream !== null && this._stream.kill();
        this._stream = null;
    }

    _getStepPromise(path, params){
        return new Promise((resolve, reject) => {
            let sw = new SpawnWrapper();
            sw.on(sw.EVENTS.done, () => {
                sw.removeAllListeners(sw.EVENTS.done);
                resolve();
            });
            sw.execute(this._getAdbAlias(), params, this._getEnv(path), 3000).catch(reject);
        });
    }

    _validateCustom(custom){
        let results = [];
        if (typeof custom === 'string'){
            custom = custom.replace(/^\s*?adb\s*/gi, '').replace(/^\s*?logcat\s*/gi, '');
            results = custom.split(' ');
        }
        return results;
    }

    start(path, reset = false, custom = null, filters = null, deviceID = null) {
        this._started = null;
        reset = typeof reset === 'boolean' ? reset : false;
        return new Promise((resolve, reject) => {
            if (this._stream !== null) {
                return resolve();
            }

            let steps = [this._getStepPromise(path, ['logcat', '-G', '1M'])];

            reset && steps.unshift(this._getStepPromise(path, ['logcat', '-c']));

            Promise.all(steps)
                .then(() => {
                    let params = [];
                    if (typeof custom === 'string' && custom.trim() !== '') {
                        const _params = this._validateCustom(custom);
                        params.push(..._params);
                    } else if (!(filters instanceof Array) || filters.length === 0) {
                        params.push(...DEFAULT_PARAMS);
                    }
                    (filters instanceof Array) && filters.forEach((filter) => {
                        if (typeof filter === 'object' && filter !== null &&
                            typeof filter.value === 'string' && filter.value.trim() !== '' &&
                            typeof filter.level === 'string' && filter.level.trim() !== ''){
                            params.unshift(`${filter.value}:${filter.level}`);
                        }
                    });
                    params.unshift('logcat');
                    if (deviceID !== null) {
                        params.unshift(...['-s', deviceID]);
                    }
                    logger.debug(`ADB Process will be started with "${this._getAdbAlias() + ' ' + params.join(' ')}"`);
                    this._stream = new SpawnWrapper();
                    this._bind();
                    this._stream.execute(this._getAdbAlias(), params, this._getEnv(path))
                        .then(() => {
                            this._started = (new Date()).getTime();
                            resolve();
                        })
                        .catch((event, error, ...args) => {
                            this._destroy();
                            reject(error);
                        });
                })
                .catch(reject);
        });
    }

    destroy(){
        this._destroy();
    }

    isRestartable(){
        let current = (new Date()).getTime();
        return this._started === null ? false : ((current - this._started) > OPTIONS.MINIMAL_RESTART_DELAY);
    }

}

class Stream extends EventEmitter {

    constructor(settings) {
        super();
        this._settings          = this._validateSettings(settings);
        this._process           = new SpawnProcess();
        this._buffer            = new StringTimerBuffer(STREAM_BUFFER_OPTIONS.LENGTH, STREAM_BUFFER_OPTIONS.DURATION);
        this._GUID              = (require('uuid/v1'))();
        this._decoder           = new StringDecoder('utf8');
        this._rest              = '';
        this._onProcessData     = this._onProcessData.bind(this);
        this._onProcessClose    = this._onProcessClose.bind(this);
        this._onBuffer          = this._onBuffer.bind(this);
        this._bindBuffer();
        this.EVENTS         = {
            ON_DATA : Symbol(),
            ON_CLOSE: Symbol()
        };
    }

    _bindBuffer(){
        this._buffer.on(this._buffer.EVENTS.timer, this._onBuffer);
    }

    _unbindBuffer(){
        this._buffer.removeAllListeners(this._buffer.EVENTS.timer);

    }

    _bindProcess(){
        if (this._process !== null) {
            this._process.on(this._process.EVENTS.ON_DATA,  this._onProcessData);
            this._process.on(this._process.EVENTS.ON_CLOSE, this._onProcessClose);
        }
    }

    _unbindProcess(){
        if (this._process !== null) {
            this._process.removeAllListeners(this._process.EVENTS.ON_DATA);
            this._process.removeAllListeners(this._process.EVENTS.ON_CLOSE);
        }
    }

    _onProcessData(buffer){
        let str = this._decode(buffer);
        if (typeof str === 'string') {
            this._buffer.add(str);
        }
    }

    _onProcessClose(){
        this._unbindProcess();
        if (this._process.isRestartable()) {
            this.open();
        } else {
            this.emit(this.EVENTS.ON_CLOSE);
        }
    }

    _onBuffer(str){
        let entries = this._getEntries(str);
        if (!(entries instanceof Array) || entries.length === 0) {
            return false;
        }
        this.emit(this.EVENTS.ON_DATA, this._GUID, entries);
    }

    _getEntries(str){
        //Add rest from previous
        str = this._rest + str;
        //Split messages
        let entries = str.split(/\r?\n|\r/gi);
        //Exclude rest (not finished message)
        if (str.search(/\n$/gi) === -1){
            this._rest = entries[entries.length - 1];
            entries.splice(-1, 1);
        } else {
            this._rest = '';
        }
        //Filter empty messages
        entries = entries.filter((str) => {
            return str.trim() !== '';
        });
        //Parsing messages
        entries = entries.map((str) => {
            return this._parseStr(str);
        }).filter((str) => {
            return str !== null;
        });
        return entries;
    }

    _parseStr(str){
        return {
            original: str
        };
    }

    _decode(message){
        try {
            return this._decoder.write(message);
        } catch (error){
            return null;
        }
    }

    _destroy(){
        this._unbindBuffer();
        this._unbindProcess();
        this._buffer.drop();
        this._process !== null && this._process.destroy();
        this._process   = null;
        this._rest      = '';
    }

    _validateSettings(settings){
        settings = typeof settings === 'object' ? (settings !== null ? settings : {}) : {};
        let _settings = {
            filters : settings.filters instanceof Array ? settings.filters : [],
            path    : typeof settings.path === 'string' ? settings.path : '',
            reset   : typeof settings.reset === 'boolean' ? settings.reset : false,
            custom  : typeof settings.custom === 'string' ? settings.custom : '',
            deviceID: typeof settings.deviceID === 'string' ? settings.deviceID : null,
        };

        return _settings;
    }

    open() {
        return this._process.start(
            this._settings !== null ? (typeof this._settings === 'object' ? this._settings.path     : null) : null,
            this._settings !== null ? (typeof this._settings === 'object' ? this._settings.reset    : null) : null,
            this._settings !== null ? (typeof this._settings === 'object' ? this._settings.custom   : null) : null,
            this._settings !== null ? (typeof this._settings === 'object' ? this._settings.filters  : null) : null,
            this._settings !== null ? (typeof this._settings === 'object' ? this._settings.deviceID : null) : null,
        )
            .then(() => {
                this._bindProcess();
            })
            .catch((error) => {
                return Promise.reject(
                    new Error(`Unable to run ADB logcat within: path = ${this._settings.path}. Please be sure ADB is installed and if it's installed into custom folder, define path to it.`)
                );
            });
    }

    setSettings(settings) {
        this._settings  = this._validateSettings(settings);
    }

    getGUID(){
        return this._GUID;
    }

    destroy(){
        this._destroy();
    }

}

class ADBStream {

    constructor(){
        this._streams               = {};
        this._manager               = new ADBManager();
        this._onClientDisconnect    = this._onClientDisconnect.bind(this);
        this._onStreamClose         = this._onStreamClose.bind(this);
        this._onStreamData          = this._onStreamData.bind(this);

        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED, this._onClientDisconnect);
    }

    _bindStream(clientGUID){
        if (this._streams[clientGUID] !== void 0){
            this._streams[clientGUID].on(this._streams[clientGUID].EVENTS.ON_CLOSE, this._onStreamClose.bind(this, clientGUID));
            this._streams[clientGUID].on(this._streams[clientGUID].EVENTS.ON_DATA,  this._onStreamData.bind(this, clientGUID));
        }
    }

    _unbindStream(clientGUID){
        if (this._streams[clientGUID] !== void 0){
            this._streams[clientGUID].removeAllListeners(this._streams[clientGUID].EVENTS.ON_CLOSE);
            this._streams[clientGUID].removeAllListeners(this._streams[clientGUID].EVENTS.ON_DATA);
        }
    }

    _onStreamClose(clientGUID){
        if (this._streams[clientGUID] !== void 0){
            this._unbindStream(clientGUID);
            this._streams[clientGUID].destroy();
            delete this._streams[clientGUID];
            logger.debug(`client ${clientGUID} stopped listen logcat stream.`);
        } else {
            logger.warning(`Stream of client ${clientGUID} is already closed`);
        }
    }

    _onStreamData(clientGUID, GUID, entries){
        if (this._streams[clientGUID] === void 0){
            return false;
        }
        const outgoingWSCommands = require('./websocket.commands.processor.js');
        ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.ADBLogcatData, {
            stream      : GUID,
            entries     : entries
        });
    }

    _onClientDisconnect(connection, clientGUID){
        this._onStreamClose(clientGUID);
    }

    open(clientGUID, settings, callback){
        if (typeof clientGUID !== 'string' || clientGUID.trim() === ''){
            return callback(false, new Error(logger.error(`[clientGUID isn't defined or defined incorrectly.`)));
        }
        if (this._streams[clientGUID] !== void 0) {
            return callback(false, new Error(logger.error(`client ${clientGUID} already is listening logcat stream.`)));
        }
        let stream  = new Stream(settings);
        stream.open()
            .then(() => {
                this._streams[clientGUID] = stream;
                this._bindStream(clientGUID);
                logger.debug(`client ${clientGUID} started listen logcat stream.`);
                callback(stream.getGUID(), null);
            })
            .catch((error) => {
                callback(false, new Error(logger.error(`client ${clientGUID} cannot open logcat stream. Error: ${error.message}`)));
            });
    }

    setSettings(clientGUID, settings, callback){
        if (this._streams[clientGUID] === void 0) {
            return callback(false, new Error(logger.error(`client ${clientGUID} isn't listening logcat stream.`)));
        }
        this._streams[clientGUID].setSettings(settings);
        logger.debug(`settings of client ${clientGUID} was updated.`);
        callback(true, null);
    }

    getDevicesList(clientGUID, settings, callback){
        this._manager.getListOfDevices(settings !== null ? (typeof settings === 'object' ? settings.path : null) : null)
            .then((devices) => {
                callback(devices, null);
            })
            .catch((e)=>{
                callback(null, e);
            });
    }

    close(clientGUID){
        this._onStreamClose(clientGUID);
    }

    try(clientGUID, settings, callback){
        this.open(clientGUID, settings, (result, error) => {
            if (error === null) {
                this.close(clientGUID);
                return callback(true, null);
            }
            callback(false, error);
        });
    }



}

let adbStream = new ADBStream();

module.exports = adbStream;


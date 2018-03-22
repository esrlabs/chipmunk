const logger            = new (require('./tools.logger'))('ServiceTelnetStream');

const
    Telnet              = require('telnet-client'),
    ServerEmitter       = require('./server.events'),
    EventEmitter        = require('events');

const TELNET_EVENTS = {
    connect     : 'connect',
    ready       : 'ready',
    writedone   : 'writedone',
    data        : 'data',
    timeout     : 'timeout',
    failedlogin : 'failedlogin',
    error       : 'error',
    end         : 'end',
    close       : 'close'
};

const CONNECTION_EVENTS = {
    READY: Symbol(),
    CLOSED: Symbol()
};

const SETTINGS = {
    host                : 'string',
    port                : 'number',
    timeout             : 'number',
    shellPrompt         : 'string',
    loginPrompt         : 'string',
    passwordPrompt      : 'string',
    failedLoginMatch    : 'string',
    initialLFCR         : 'boolean',
    username            : 'string',
    password            : 'string',
    irs                 : 'string',
    ors                 : 'string',
    echoLines           : 'number',
    stripShellPrompt    : 'boolean',
    pageSeparator       : 'string',
    negotiationMandatory: 'boolean',
    execTimeout         : 'number',
    sendTimeout         : 'number',
    maxBufferLength     : 'number',
    debug               : 'boolean'
};



class Connection extends EventEmitter{

    constructor(clientGUID, alias, settings){
        super();
        this.clients        = [clientGUID];
        this.GUID           = (require('uuid/v1'))();
        this.alias          = alias;
        this.settings       = settings;
        this.connection     = null;
        this.ready          = false;
        this.connected      = false;
        this.buffer         = '';
        this.openCallback   = null;
        //Bind methods
        Object.keys(TELNET_EVENTS).forEach((event)=>{
            this['on' + event] = this['on' + event].bind(this);
        });
    }

    addClient(clientGUID){
        !~this.clients.indexOf(clientGUID) && this.clients.push(clientGUID);
    }

    removeClient(clientGUID){
        ~this.clients.indexOf(clientGUID) && this.clients.splice(this.clients.indexOf(clientGUID), 1);
    }

    countClients(){
        return this.clients.length;
    }

    getClients(){
        return this.clients;
    }

    getAlias(){
        return this.alias;
    }

    _subscribeConnectionEvents(){
        if (this.connection === null) {
            return false;
        }
        //Attach events
        Object.keys(TELNET_EVENTS).forEach((event)=>{
            this.connection.on(TELNET_EVENTS[event], this['on' + event]);
        });
    }

    _unsubscribeConnectionEvents(){
        if (this.connection === null) {
            return false;
        }
        //Detach events
        Object.keys(TELNET_EVENTS).forEach((event)=>{
            this.connection.removeAllListeners(TELNET_EVENTS[event]);
        });
    }

    onOpenCallback(error){
        this.openCallback !== null && this.openCallback((error !== null ? null : this.GUID), error);
        this.openCallback = null;
    }

    open(callback){
        try {
            this.openCallback = callback;
            this.connection = new Telnet();
            this._subscribeConnectionEvents();
            this.connection.connect(this.settings);
        } catch (error){
            logger.error('[session: ' + this.GUID + ']:: Fail to create telnet connection: ' + this.alias + '. Error: ' + error.message);
            this.onOpenCallback(error);
        }
    }

    close(callback){
        if (this.connection !== null) {
            this.ready = false;
            this._unsubscribeConnectionEvents();
            this.connection.end();
            this.connection.destroy();
            this.emit(CONNECTION_EVENTS.CLOSED, this.GUID);
            logger.debug('[session: ' + this.GUID + ']:: Telnet connection is closed: ' + this.alias);
        } else {
            logger.warning('[session: ' + this.GUID + ']:: Telnet connection is already closed: ' + this.alias);
        }
        callback(null);
    }

    send(data, callback){
        if (this.connection === null || !this.ready){
            callback(null, new Error(logger.debug(`Telnet connection "${this.alias}" isn't established yet.`)));
            return false;
        }
        logger.debug('[session: ' + this.GUID + ']:: Telnet connection: ' + this.alias + '. Attempt to write data: ' + data);
        this.connection.send(data)
            .then(() => {
                logger.debug('[session: ' + this.GUID + ']:: Telnet connection: ' + this.alias + '. Data is written.');
                callback(null);
            })
            .catch((error) => {
                logger.warning(`Error during sedning data: ${error.message}`);
                callback(error);
            });
    }

    ['on' + TELNET_EVENTS.connect](...args){
        this.connected = true;
        logger.debug('[session: ' + this.GUID + ']:: [connect] event. Telnet connection: ' + this.alias + ' is connected. ');
    }

    ['on' + TELNET_EVENTS.ready](prompt){
        this.ready = true;
        this.onOpenCallback(null);
        this.emit(CONNECTION_EVENTS.READY);
    }

    ['on' + TELNET_EVENTS.writedone](...args){
        logger.debug('[session: ' + this.GUID + ']:: [close] writedone. Telnet connection: ' + this.alias + ' write operation is done. ');
    }

    ['on' + TELNET_EVENTS.data](data) {
        try {
            let outgoingWSCommands = require('./websocket.commands.processor.js');
            this.clients.forEach((clientGUID)=>{
                ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.TelnetData, {
                    connection  : this.GUID,
                    data        : typeof data === 'string' ? data : data.toString('utf8')
                });
            });
        } catch (e){
            logger.debug('[session: ' + this.GUID + ']:: Telnet connection data error: ' + this.alias + '; error: ' + e.message);
        }
    }

    ['on' + TELNET_EVENTS.timeout](){
        const error = new Error(logger.debug('[session: ' + this.GUID + ']:: [timeout] event. Telnet connection timeout: ' + this.alias + '.'));
        this.close(() => {
            this.onOpenCallback(error);
        });
    }

    ['on' + TELNET_EVENTS.failedlogin](message){
        if (this.settings.username === '' && this.settings.password === '') {
            this['on' + TELNET_EVENTS.ready]();
            typeof message === 'string' && this['on' + TELNET_EVENTS.data](message);
        } else {
            this.close(() => {
                this.onOpenCallback(new Error(logger.debug('[session: ' + this.GUID + ']:: [failedlogin] event. Telnet connection: ' + this.alias + ' fail to login.')));
            });
        }
    }

    ['on' + TELNET_EVENTS.error](error){
        error = error instanceof Error ? error : new Error(error);
        logger.debug('[session: ' + this.GUID + ']:: [error] event. Telnet connection error: ' + this.alias + '; error: ' + error.message);
        this.close(() => {
            this.onOpenCallback(error);
        });
    }

    ['on' + TELNET_EVENTS.end](){
        logger.debug('[session: ' + this.GUID + ']:: [end] event. Telnet connection: ' + this.alias + ' is ended. ');
    }

    ['on' + TELNET_EVENTS.close](){
        logger.debug('[session: ' + this.GUID + ']:: [close] event. Telnet connection: ' + this.alias + ' is closed. ');
        this.close(() => {});
    }

}

class ServiceTelnetStream{

    constructor(){
        this.GUID               = (require('uuid/v1'))();
        this.connections        = {};
        this.onClientDisconnect = this.onClientDisconnect.bind(this);
        this.onSendToTelnet     = this.onSendToTelnet.bind(this);
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED,   this.onClientDisconnect );
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.WRITE_TO_TELNET,          this.onSendToTelnet     );
    }

    getAlias(settings){
        return settings.host + ':' + settings.port;
    }

    validateSettings(settings){
        if (typeof settings !== 'object' || settings === null) {
            return {};
        }
        Object.keys(SETTINGS).forEach((key)=>{
            if (typeof settings[key] !== SETTINGS[key]){
                delete settings[key];
            }
            if (typeof settings[key] === 'string' && settings[key] === ''){
                //delete settings[key];
            }
        });
        return settings;
    }

    open(clientGUID, settings, callback){
        this.closeStreamsOfClient(clientGUID);
        settings = this.validateSettings(settings);
        const alias = this.getAlias(settings);
        let stream = this.getStream(alias);
        if (stream === null) {
            let connection = new Connection(clientGUID, alias, settings);
            connection.open((GUID, error)=>{
                if (error === null){
                    this.connections[GUID] = connection;
                    connection.on(CONNECTION_EVENTS.CLOSED, this.onConnectionClosed.bind(this, GUID));
                    callback(GUID, null);
                } else {
                    callback(null, error);
                }
            });
        } else {
            stream.addClient(clientGUID);
            callback(stream.GUID, null);
            logger.debug('[session: ' + this.GUID + ']:: Attached listener to telnet connection: ' + alias);
        }
    }

    close(clientGUID, connection, callback){
        if (this.connections[connection] !== void 0){
            this.connections[connection].removeClient(clientGUID);
            this.connections[connection].close((error)=>{
                callback(error);
            });
            this.clearNotUsedStreams();
        } else {
            callback(null);
        }
    }

    closeStreamsOfClient(clientGUID){
        Object.keys(this.connections).forEach((GUID)=>{
            this.connections[GUID].removeClient(clientGUID);
            this.sendClosedNotification(clientGUID, GUID);
        });
        Object.keys(this.connections).filter((GUID)=>{
            return this.connections[GUID].countClients() === 0;
        }).forEach((GUID)=>{
            this.connections[GUID].close(()=>{
            });
            delete this.connections[GUID];
        });
    }

    clearNotUsedStreams(){
        Object.keys(this.connections).filter((GUID)=>{
            return this.connections[GUID].countClients() === 0;
        }).forEach((GUID)=>{
            delete this.connections[GUID];
        });
    }

    getStreamOfClient(streamGUID, alias){
        let stream = null;
        Object.keys(this.connections).forEach((GUID)=>{
            if (GUID === streamGUID && this.connections[GUID].getAlias() === alias ){
                stream = this.connections[GUID];
            }
        });
        return stream;
    }

    getStream(alias){
        let stream = null;
        Object.keys(this.connections).forEach((GUID)=>{
            if (this.connections[GUID].getPort() === alias ){
                stream = this.connections[GUID];
            }
        });
        return stream;
    }


    onClientDisconnect(connection, clientGUID){
        this.closeStreamsOfClient(clientGUID);
    }

    onSendToTelnet(connection, params){
        if (typeof params === 'object' && params !== null){
            if (params.streamGUID !== void 0 && params.alias !== void 0 && params.buffer !== void 0 && params.packageGUID !== void 0){
                let stream = this.getStreamOfClient(params.streamGUID, params.alias);
                if (stream !== null){
                    stream.send(params.buffer, (error)=>{
                        let outgoingWSCommands = require('./websocket.commands.processor.js');
                        ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, connection, outgoingWSCommands.COMMANDS.ResultWrittenToTelnet, {
                            streamGUID  : params.streamGUID,
                            packageGUID : params.packageGUID,
                            error       : error ? error.message : null
                        });
                        error && logger.error('[session: ' + this.GUID + ']:: Port [' + params.alias + '] for client [' + params.streamGUID + '] an error during writing into port: ' + error.message);
                    });
                } else {
                    logger.error('[session: ' + this.GUID + ']:: Port [' + params.alias + '] for client [' + params.streamGUID + '] was not found.');
                }
            } else {
                logger.error('[session: ' + this.GUID + ']:: Bad parameters for [onSendToTelnet]. Expected: streamGUID, alias, buffer.');
            }
        } else {
            logger.error('[session: ' + this.GUID + ']:: Bad parameters for [onSendToTelnet]. Expected: streamGUID, alias, buffer.');
        }
    }

    onConnectionClosed(GUID){
        if (this.connections[GUID] === void 0) {
            return false;
        }
        const clients = this.connections[GUID].getClients();
        clients.forEach((clientGUID) => {
            this.sendClosedNotification(clientGUID, GUID);
        });
        this.connections[GUID].removeAllListeners(CONNECTION_EVENTS.CLOSED);
        this.connections[GUID].close(()=>{
            delete this.connections[GUID];
        });
    }

    sendClosedNotification(clientGUID, connectionGUID){
        let outgoingWSCommands = require('./websocket.commands.processor.js');
        ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.TelnetClosed, {
            connection  : connectionGUID
        });
    }

}
let serviceTelnetStream = new ServiceTelnetStream();

module.exports          = serviceTelnetStream;
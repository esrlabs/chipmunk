const logger            = new (require('./tools.logger'))('ServiceSerialStream');

const
    SerialPort          = require('serialport'),
    ServerEmitter       = require('./server.events'),
    StringTimerBuffer   = require('./tools.buffers').StringTimerBuffer;

const PORT_EVENTS = {
    open    : 'open',
    data    : 'data',
    error   : 'error',
};

const PORT_STATES = {
    LISTENING   : Symbol(),
    WRITING     : Symbol()
};

const WRITER_STATES = {
    READY       : Symbol('READY'),
    WRITING     : Symbol('WRITING')
};

const STREAM_BUFFER_OPTIONS = {
  LENGTH      : 300000,
  DURATION    : 200 //ms. If duration between on Data event less than here, data will be included into one package
};

class PortWriter {

    constructor(instance, settings){
        this.instance   = instance;
        this.callback   = null;
        this.size       = 1;        //count of symbols
        this.state      = WRITER_STATES.READY;
        this.settings   = {
            vtransmit: typeof settings === 'object' ? (settings !== null ? (typeof settings.vtransmit === 'number' ? settings.vtransmit : 50) : 50) : 50
        };
    }

    write(buffer, callback){
        if (this.getState() === WRITER_STATES.READY) {
            this.callback   = callback;
            this.state      = WRITER_STATES.WRITING;
            this.next(buffer);
        }
    }

    getState(){
        return this.state;
    }

    setState(state){
        this.state = state;
    }

    isReady(){
        return this.state === WRITER_STATES.READY;
    }

    next(buffer){
        if (typeof buffer === 'string' && buffer.length > 0){
            buffer = buffer.replace(/\r?\n|\r/gi, '');
            let bufferIn    = buffer.substr(0,this.size),
                bufferOut   = buffer.substr(this.size, buffer.length);
            setTimeout(()=>{
                try{
                    this.instance.write(bufferIn + (bufferOut === '' ? '\n\r' : ''), (error)=>{
                        error   && this.onError(error);
                        !error  && this.instance.drain(()=>{
                            this.next(bufferOut);
                        });
                    });
                } catch (error){
                    this.onError(error);
                }
            }, this.settings.vtransmit);
        } else {
            this.onFinish();
        }
    }

    onError(error){
        logger.error('Error during sending. Error: ' + error.message);
        this.setState(WRITER_STATES.READY);
        this.callback(error);
    }

    onFinish(){
        logger.debug('Finish sending.');
        this.setState(WRITER_STATES.READY);
        this.callback();
    }
}

class Port{

    constructor(clientGUID, port, settings){
        this.clients        = [clientGUID];
        this.GUID           = (require('uuid/v1'))();
        this.port           = port;
        settings.autoOpen   = false;
        settings.lock       = false;
        this.settings       = settings;
        this.instance       = null;
        this.ready          = false;
        this.state          = PORT_STATES.LISTENING;
        this.buffer         = '';
        this.tasks          = [];
        this.taskID         = 0;
        this.writer         = null;
        this._buffer        = new StringTimerBuffer(STREAM_BUFFER_OPTIONS.LENGTH, STREAM_BUFFER_OPTIONS.DURATION);
        this._onBuffer          = this._onBuffer.bind(this);
        this._bindBuffer();
    }

    _bindBuffer(){
        this._buffer.on(this._buffer.EVENTS.timer, this._onBuffer);
    }

    _unbindBuffer(){
        this._buffer.removeAllListeners(this._buffer.EVENTS.timer);
    }

    _onBuffer(str){
        if (this.state === PORT_STATES.LISTENING){
            this.triggerData(str);
        } else {
            this.buffer += str;
        }
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

    open(callback){
        try {
            this.instance = new SerialPort(this.port, this.settings);
            this.instance.open((error) => {
                if (error) {
                    logger.error('[session: ' + this.GUID + ']:: Fail to open port: ' + this.port + '. Error: ' + error.message);
                    callback(null, error);
                } else {
                    this.ready  = true;
                    this.writer = new PortWriter(this.instance, this.settings);
                    logger.debug('[session: ' + this.GUID + ']:: Port is opened: ' + this.port);
                    callback(this.GUID, null);
                    //this.emulate();
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


    close(callback){
        if (this.ready) {
            this.ready = false;
            this.instance.close(callback);
            this._unbindBuffer();
            logger.debug('[session: ' + this.GUID + ']:: Port is closed: ' + this.port);
        } else {
            callback();
            logger.warning('[session: ' + this.GUID + ']:: Port is already closed: ' + this.port);
        }
    }

    logAndCallWithError(msg, callback, error){
        logger.debug('[session: ' + this.GUID + '][' + this.port + ']:: ' + msg);
        typeof callback === 'function' && callback(error !== void 0 ? error : (new Error(msg)));
    }

    write(buffer = '', callback){
        if (this.ready && this.instance instanceof SerialPort){
            if (typeof buffer === 'string'){
                this.proceedTasks(buffer, callback);
            } else {
                this.logAndCallWithError('Type of buffer can be Array<any> or String', callback);
            }
        } else {
            this.logAndCallWithError('Target socket is not ready for writing.', callback);
        }
    }

    removeWriteTask(taskID){
        this.tasks = this.tasks.filter((task) => {
            return task.id !== taskID;
        });
    }

    proceedTasks(buffer = null, callback = null){
        if (buffer !== null && callback !== null) {
            this.tasks.push({
                id      : this.taskID++,
                buffer  : buffer,
                callback: callback
            });
        }
        if (this.writer.isReady() && this.tasks.length > 0){
            let taskID      = this.tasks[0].id,
                buffer      = this.tasks[0].buffer,
                callback    = this.tasks[0].callback;
            this.changeState(PORT_STATES.WRITING);
            this.writer.write(
                buffer,
                (error) => {
                    this.removeWriteTask(taskID);
                    if (error){
                        this.logAndCallWithError('Error during writing to serial: ' + error.message, callback, error);
                        typeof callback === 'function' && callback(error);
                    } else {
                        logger.debug('[session: ' + this.GUID + '][' + this.port + ']:: Written into port successfully. Content: [' + (buffer instanceof Array ? buffer.join(', ') : buffer) + ']');
                        typeof callback === 'function' && callback(null);
                    }
                    this.changeState(PORT_STATES.LISTENING);
                    this.proceedTasks(null, null);
                }
            );
        }
    }

    changeState(state){
        this.state = state;
        switch (this.state){
            case PORT_STATES.LISTENING:
                if (this.buffer !== ''){
                    this.triggerData(this.buffer);
                    this.buffer = '';
                }
                break;
            case PORT_STATES.WRITING:
                this.buffer = '';
                break;
        }
    }

    triggerData(str){
        let outgoingWSCommands = require('./websocket.commands.processor.js');
        this.clients.forEach((clientGUID)=>{
            ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.SerialData, {
                connection  : this.GUID,
                data        : str
            });
        });
    }

    ['on' + PORT_EVENTS.open](){

    }

    ['on' + PORT_EVENTS.error](error){
        this.ready = false;
    }

    ['on' + PORT_EVENTS.data](data){
        this._buffer.add(data.toString('utf8'));
    }

    emulate(){
      setTimeout(()=>{
        let str = '';
        for (let i = Math.random()* 255; i >=0; i -= 1){
          str += Math.round(Math.random() * 100) + ' ';
        }
        if (Math.random() > 0.3){
          str += '\n';
        }
        let buffer = Buffer.from(str, 'utf8');
        this['on' + PORT_EVENTS.data](buffer);
        this.emulate();
      }, Math.random()*500)
    }
}

class ServiceSerialStream{

    constructor(){
        this.GUID               = (require('uuid/v1'))();
        this.ports              = {};
        this.onClientDisconnect = this.onClientDisconnect.bind(this);
        this.onWriteToSerial    = this.onWriteToSerial.bind(this);
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED,   this.onClientDisconnect );
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.WRITE_TO_SERIAL,          this.onWriteToSerial    );
    }

    getListPorts(callback){
        SerialPort.list((error, ports) => {
            if (error === null){
                logger.debug('[session: ' + this.GUID + ']:: Getting list of ports...');
                ports.forEach((port) => {
                    logger.debug('[session: ' + this.GUID + ']:: '+
                        'comName: '         + (port.comName         === 'string' ? port.comName         : '[no data]') +
                        '; pnpId: '         + (port.pnpId           === 'string' ? port.pnpId           : '[no data]') +
                        '; manufacturer: '  + (port.manufacturer    === 'string' ? port.manufacturer    : '[no data]'));
                });
                callback(ports);
            } else {
                logger.error('[session: ' + this.GUID + ']:: Error during getting list of ports: ' + error.message);
                callback(error);
            }
        });

    }

    open(clientGUID, port, settings, callback){
        let _port = this.getPortOfPort(port);
        if (_port === null) {
            let instance = new Port(clientGUID, port, settings);
            instance.open((GUID, error)=>{
                if (error === null){
                    this.ports[GUID] = instance;
                    callback(GUID, null);
                } else {
                    callback(null, error);
                }
            });
        } else {
            _port.addClient(clientGUID);
            callback(_port.GUID, null);
            logger.debug('[session: ' + this.GUID + ']:: Attached listener to port: ' + port);
        }
    }

    close(clientGUID, connection, callback){
        if (this.ports[connection] !== void 0){
            this.ports[connection].removeClient(clientGUID);
            this.ports[connection].close((error)=>{
                callback(error);
            });
            this.clearNotUsedPorts();
        }
    }

    closePortsOfClient(clientGUID){
        Object.keys(this.ports).forEach((GUID)=>{
            this.ports[GUID].removeClient(clientGUID);
        });
        Object.keys(this.ports).filter((GUID)=>{
            return this.ports[GUID].countClients() === 0;
        }).forEach((GUID)=>{
            this.ports[GUID].close();
            delete this.ports[GUID];
        });
    }

    clearNotUsedPorts(){
        Object.keys(this.ports).filter((GUID)=>{
            return this.ports[GUID].countClients() === 0;
        }).forEach((GUID)=>{
            delete this.ports[GUID];
        });
    }

    getPortOfClient(serialGUID, port){
        let _port = null;
        Object.keys(this.ports).forEach((GUID)=>{
            if (GUID === serialGUID && this.ports[GUID].getPort() === port ){
                _port = this.ports[GUID];
            }
        });
        return _port;
    }

    getPortOfPort(port){
        let _port = null;
        Object.keys(this.ports).forEach((GUID)=>{
            if (this.ports[GUID].getPort() === port ){
                _port = this.ports[GUID];
            }
        });
        return _port;
    }


    onClientDisconnect(connection, clientGUID){
        this.closePortsOfClient(clientGUID);
    }

    onWriteToSerial(connection, params){
        if (typeof params === 'object' && params !== null){
            if (params.serialGUID !== void 0 && params.port !== void 0 && params.buffer !== void 0 && params.packageGUID !== void 0){
                let port = this.getPortOfClient(params.serialGUID, params.port);
                if (port !== null){
                    port.write(params.buffer, (error)=>{
                        let outgoingWSCommands = require('./websocket.commands.processor.js');
                        ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, connection, outgoingWSCommands.COMMANDS.ResultWrittenToSerial, {
                            serialGUID  : params.serialGUID,
                            packageGUID : params.packageGUID,
                            error       : error ? error.message : null
                        });
                        error && logger.error('[session: ' + this.GUID + ']:: Port [' + params.port + '] for client [' + params.clientGUID + '] an error during writing into port: ' + error.message);
                    });
                } else {
                    logger.error('[session: ' + this.GUID + ']:: Port [' + params.port + '] for client [' + params.clientGUID + '] was not found.');
                }
            } else {
                logger.error('[session: ' + this.GUID + ']:: Bad parameters for [onWriteToSerial]. Expected: clientGUID, port, buffer.');
            }
        } else {
            logger.error('[session: ' + this.GUID + ']:: Bad parameters for [onWriteToSerial]. Expected: clientGUID, port, buffer.');
        }
    }

}
let serviceSerialStream = new ServiceSerialStream();

module.exports          = serviceSerialStream;

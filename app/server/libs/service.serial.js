const Signature         = 'ServiceSerialStream';

const
    SerialPort        = require('serialport'),
    ServerEmitter     = require('./server.events');

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
            buffer = buffer.replace(/[\n\r]/gi, '');
            let bufferIn    = buffer.substr(0,this.size),
                bufferOut   = buffer.substr(this.size, buffer.length);
            setTimeout(()=>{
                console.log('[' + Signature + ']:: Sending: "' + bufferIn + '".');
                this.instance.write(bufferIn + (bufferOut === '' ? '\n\r' : ''), (error)=>{
                    error   && this.onError(error);
                    !error  && this.instance.drain(()=>{
                        this.next(bufferOut);
                    });
                });
            }, this.settings.vtransmit);
        } else {
            this.onFinish();
        }
    }

    onError(error){
        console.log('[' + Signature + '] Error during sending. Error: ' + error.message);
        this.setState(WRITER_STATES.READY);
        this.callback(error);
    }

    onFinish(){
        console.log('[' + Signature + '] Finish sending.');
        this.setState(WRITER_STATES.READY);
        this.callback();
    }
}

class Port{

    constructor(clientGUID, port, settings){
        this.clients        = [clientGUID];
        this.GUID           = (require('guid')).raw();
        this.port           = port;
        this.settings       = settings;
        settings.autoOpen   = false;
        this.instance       = null;
        this.ready          = false;
        this.state          = PORT_STATES.LISTENING;
        this.buffer         = '';
        this.tasks          = [];
        this.taskID         = 0;
        this.writer         = null;
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
        this.instance = new SerialPort(this.port, this.settings);
        this.instance.open((error) => {
            if (error) {
                console.log('[' + Signature + '][session: ' + this.GUID + ']:: Fail to open port: ' + this.port + '. Error: ' + error.message);
                callback(null, error);
            } else {
                this.ready  = true;
                this.writer = new PortWriter(this.instance, this.settings);
                console.log('[' + Signature + '][session: ' + this.GUID + ']:: Port is opened: ' + this.port);
                callback(this.GUID, null);
            }
        });
        //Attach events
        Object.keys(PORT_EVENTS).forEach((event)=>{
            this.instance.on(PORT_EVENTS[event], this['on' + event].bind(this));
        });
    }

    getPort(){
        return this.port;
    }

    close(callback){
        this.ready = false;
        this.instance.close(callback);
        console.log('[' + Signature + '][session: ' + this.GUID + ']:: Port is closed: ' + this.port);
    }

    logAndCallWithError(msg, callback, error){
        console.log('[' + Signature + '][session: ' + this.GUID + '][' + this.port + ']:: ' + msg);
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
                        console.log('[' + Signature + '][session: ' + this.GUID + '][' + this.port + ']:: Written into port successfully. Content: [' + (buffer instanceof Array ? buffer.join(', ') : buffer) + ']');
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
                    this.triggerDate(this.buffer);
                    this.buffer = '';
                }
                break;
            case PORT_STATES.WRITING:
                this.buffer = '';
                break;
        }
    }

    triggerDate(str){
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
        if (this.state === PORT_STATES.LISTENING){
            this.triggerDate(data.toString('utf8'));
        } else {
            this.buffer += data.toString('utf8');
        }
        console.log(')))))===> ' + data);
    }
}

class ServiceSerialStream{

    constructor(){
        this.GUID               = (require('guid')).raw();
        this.ports              = {};
        this.onClientDisconnect = this.onClientDisconnect.bind(this);
        this.onWriteToSerial    = this.onWriteToSerial.bind(this);
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED,   this.onClientDisconnect );
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.WRITE_TO_SERIAL,          this.onWriteToSerial    );
    }

    getListPorts(callback){
        SerialPort.list((error, ports) => {
            if (error === null){
                console.log('[' + Signature + '][session: ' + this.GUID + ']:: Getting list of ports...');
                ports.forEach((port) => {
                    console.log('[' + Signature + '][session: ' + this.GUID + ']:: '+
                        'comName: '         + (port.comName         === 'string' ? port.comName         : '[no data]') +
                        '; pnpId: '         + (port.pnpId           === 'string' ? port.pnpId           : '[no data]') +
                        '; manufacturer: '  + (port.manufacturer    === 'string' ? port.manufacturer    : '[no data]'));
                });
                callback(ports);
            } else {
                console.log('[' + Signature + '][session: ' + this.GUID + ']:: Error during getting list of ports: ' + error.message);
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
            console.log('[' + Signature + '][session: ' + this.GUID + ']:: Attached listener to port: ' + port);
        }
    }

    close(clientGUID, connection, callback){
        if (this.ports[connection] !== void 0){
            this.ports[connection].close((error)=>{
                callback(error);
            });
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
                        error && console.log('[' + Signature + '][session: ' + this.GUID + ']:: Port [' + params.port + '] for client [' + params.clientGUID + '] an error during writing into port: ' + error.message);
                    });
                } else {
                    console.log('[' + Signature + '][session: ' + this.GUID + ']:: Port [' + params.port + '] for client [' + params.clientGUID + '] was not found.');
                }
            } else {
                console.log('[' + Signature + '][session: ' + this.GUID + ']:: Bad parameters for [onWriteToSerial]. Expected: clientGUID, port, buffer.');
            }
        } else {
            console.log('[' + Signature + '][session: ' + this.GUID + ']:: Bad parameters for [onWriteToSerial]. Expected: clientGUID, port, buffer.');
        }
    }

}
let serviceSerialStream = new ServiceSerialStream();

module.exports          = serviceSerialStream;

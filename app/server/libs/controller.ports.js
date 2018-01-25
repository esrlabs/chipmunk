const logger        = new (require('./tools.logger'))('ControllerPorts');
const Events        = require('events');
const SerialPort    = require('serialport');
const util          = require('util');

const PORT_EVENTS = {
    open    : 'open',
    data    : 'data',
    error   : 'error',
};

const DEFAULT_PORT_SETTINGS = {
    lock           : true,
    baudRate       : 921600,
    dataBits       : 8,
    stopBits       : 1,
    rtscts         : false,
    xon            : false,
    xoff           : false,
    xany           : false,
    bufferSize     : 65536,
    vmin           : 1,
    vtime          : 0,
    vtransmit      : 50
};

class Port extends Events.EventEmitter {

    constructor(port, settings){
        super();
        this.GUID           = (require('uuid/v1'))();
        this.port           = port;
        this.settings       = settings;
        settings.autoOpen   = false;
        this.instance       = null;
        this.EVENTS         = {
            ON_DATA : Symbol(),
            ON_OPEN : Symbol(),
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
                    logger.error(`[session: ${this.GUID}]:: Fail to open port: ${this.port}. Error: ${error.message}.`);
                    this.close(() => {});
                    this.emit(this.EVENTS.ON_ERROR, error);
                } else {
                    logger.debug(`[session: ${this.GUID}]:: Port is opened: ${this.port}.`);
                }
            });
            //Attach events
            Object.keys(PORT_EVENTS).forEach((event)=>{
                this.instance.on(PORT_EVENTS[event], this['on' + event].bind(this));
            });
        } catch (error){
            logger.error(`[session: ${this.GUID}]:: Fail to create port: ${this.port}. Error: ${error.message}.`);
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
            logger.debug(`[session: ${this.GUID}]:: Port is closed: ${this.port}.`);
        } else {
            logger.warning(`[session: ${this.GUID}]:: Port is already closed: ${this.port}.`);
        }
    }

    ['on' + PORT_EVENTS.open](...args){
        this.emit(this.EVENTS.ON_OPEN, ...args);

    }

    ['on' + PORT_EVENTS.error](error, ...args){
        this.emit(this.EVENTS.ON_ERROR, error, ...args);
        logger.error(`[session: ${this.GUID}]:: Port: ${this.port} gives an error: ${error.message}.`);
    }

    ['on' + PORT_EVENTS.data](data, ...args){
        try {
            typeof data.toString === 'function' && this.emit(this.EVENTS.ON_DATA, data.toString('utf8'), ...args);
        } catch (error) {
            logger.error(`[session: ${this.GUID}]:: Error during reading data from: ${this.port}. Error: ${error.message}.`);
        }
    }
}

class Ports {

    constructor(){
        this.ports = {};
    }

    _open(port, settings){

    }

    _parseSettings(settings){
        if (typeof settings !== 'object' || settings === null) {
            return new Error(logger.error(`Failed attempt to provide settings of port with wrong format of it: ${util.inspect(settings)}.`));
        }
        Object.keys(DEFAULT_PORT_SETTINGS).forEach((key) => {
            if (typeof DEFAULT_PORT_SETTINGS[key] !== typeof settings[key]) {
                logger.warning(`Property ${key} of port settings has wrong format: ${(typeof settings[key])}. Default value will be used: ${key} = ${DEFAULT_PORT_SETTINGS[key]}.`);
                settings[key] = DEFAULT_PORT_SETTINGS[key];
            }
        });
        return settings;
    }

    open(port, settings){
        if (typeof port !== 'string' || port.trim() === '') {
            return new Error(logger.error(`Failed attempt to open port with wrong value of port: ${util.inspect(port)}.`));
        }

        settings = this._parseSettings(settings);
        if (settings instanceof Error) {
            return settings;
        }

        this._open(port, settings);
    }


}

let ports = new Ports();

module.exports = ports;

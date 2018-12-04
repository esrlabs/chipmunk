const logger            = new (require('./tools.logger'))('ServiceDLTStream');

const
    Dlt                 = require('dlt-node'),
    DltExtHeaders       = require('dlt-node/protocol/dltextendedheader'),
    DltPayloadArgs      = require('dlt-node/protocol/dltpayloadargument'),
    Net                 = require('net'),
    ServerEmitter       = require('./server.events'),
    StringTimerBuffer   = require('./tools.buffers').StringTimerBuffer;
    EventEmitter        = require('events'),
    outgoingWSCommands  = require('./websocket.commands.processor.js');

const DLT_EVENTS = {
    packet  : 'packet',
};

const NET_EVENTS = {
    data    : 'data',
    error   : 'error',
    close   : 'close',
};

const HOST_CONNECTION_EVENT = {
    data    : 'data',
    close   : 'close',
};

const STREAM_BUFFER_OPTIONS = {
    LENGTH      : 300000,
    DURATION    : 200 //ms. If duration between on Data event less than here, data will be included into one package
  };
  
const DltLogLevel = {
    off: 0,
    fatal: 1,
    error: 2,
    warn: 3,
    info: 4,
    debug: 5,
    verbose: 6
}

const DltLogLevelCodes = {
    0: [],
    1: [DltExtHeaders.DLT_LOG_FATAL],
    2: [DltExtHeaders.DLT_LOG_FATAL, DltExtHeaders.DLT_LOG_ERROR],
    3: [DltExtHeaders.DLT_LOG_FATAL, DltExtHeaders.DLT_LOG_ERROR, DltExtHeaders.DLT_LOG_WARN],
    4: [DltExtHeaders.DLT_LOG_FATAL, DltExtHeaders.DLT_LOG_ERROR, DltExtHeaders.DLT_LOG_WARN, DltExtHeaders.DLT_LOG_INFO],
    5: [DltExtHeaders.DLT_LOG_FATAL, DltExtHeaders.DLT_LOG_ERROR, DltExtHeaders.DLT_LOG_WARN, DltExtHeaders.DLT_LOG_INFO, DltExtHeaders.DLT_LOG_DEBUG],
    6: [DltExtHeaders.DLT_LOG_FATAL, DltExtHeaders.DLT_LOG_ERROR, DltExtHeaders.DLT_LOG_WARN, DltExtHeaders.DLT_LOG_INFO, DltExtHeaders.DLT_LOG_DEBUG, DltExtHeaders.DLT_LOG_VERBOSE],
}

class PacketParser {

    constructor() {
        this._regUniCodes = /\\u\d{4}/gi;
        this._regNullCodes = /\0/gi;
    }

    hasExtHeaders(packet) {
        if (packet.values === void 0) {
            return false;
        }
        if (packet.values.ExtendedHeader === void 0) {
            return false;
        }
        return true;
    }

    hasPayload(packet) {
        if (typeof packet.values !== 'object' || packet.values === null) {
            return false;
        }
        if (typeof packet.values.Payload !== 'object' || packet.values.Payload === null) {
            return false;
        }
        if (!(packet.values.Payload.Arguments instanceof Array)) {
            return false;
        }
        return true;
    }

    isLog(packet) {
        if (!this.hasExtHeaders(packet)) {
            return false;
        }
        if (packet.values.ExtendedHeader.MessageType !== DltExtHeaders.DLT_TYPE_LOG){
            return false;
        }
        return true;
    }

    isAllowedLevel(packet, level) {
        if (!this.hasExtHeaders(packet)) {
            return false;
        }
        if (DltLogLevelCodes[level] === void 0) {
            return false;
        }
        if (DltLogLevelCodes[level].indexOf(packet.values.ExtendedHeader.MessageTypeInfo) === -1) {
            return false;
        }
        return true;
    }
    
    clearStrValue(val){
        if (typeof val !== 'string' && val.toString !== void 0) {
            val = val.toString();
        } else if (typeof val !== 'string'){
            return '';
        }
        return val.replace(this._regUniCodes, '').replace(this._regNullCodes, '').trim();
    }

    getInfoBlock(packet) {
        let info = '';
        if (packet.values === void 0) {
            return '';
        }
        if (packet.values.StandardHeader !== void 0) {
            if (packet.values.StandardHeader.Timestamp !== void 0) {
                let value = this.clearStrValue(packet.values.StandardHeader.Timestamp);
                info += (value + ' '.repeat(15 - value.length));
            } else {
                info += ' '.repeat(15);
            }
            if (packet.values.StandardHeader.EcuId !== void 0) {
                let value = this.clearStrValue(packet.values.StandardHeader.EcuId);
                info += (value + ' '.repeat(10 - value.length));
            } else {
                info += ' '.repeat(10);
            }
            if (packet.values.StandardHeader.SessionId !== void 0) {
                let value = this.clearStrValue(packet.values.StandardHeader.SessionId);
                info += (value + ' '.repeat(10 - value.length));
            } else {
                info += ' '.repeat(10);
            }
        }
        if (packet.values.ExtendedHeader !== void 0) {
            if (packet.values.ExtendedHeader.AppId !== void 0) {
                let value = this.clearStrValue(packet.values.ExtendedHeader.AppId);
                info += (value + ' '.repeat(10 - value.length));
            } else {
                info += ' '.repeat(10);
            }
            if (packet.values.ExtendedHeader.ContextId !== void 0) {
                let value = this.clearStrValue(packet.values.ExtendedHeader.ContextId);
                info += (value + ' '.repeat(10 - value.length));
            } else {
                info += ' '.repeat(10);
            }
        }
        return info;
    }

    getPayloadStr(packet) {
        let result = '';
        if (!this.hasPayload(packet)) {
            return null;
        }
        packet.values.Payload.Arguments.forEach((argument) => {
            if (argument.TypeInfo & DltPayloadArgs.FLAG_TypeString) {
                result += this.clearStrValue(argument.Data);
            }
        });
        return result === '' ? '' : (this.getInfoBlock(packet) + result);
    }

}

class HostConnection extends EventEmitter {

    constructor(host, port, settings) {
        super();
        this.client = null;
        this.host = host;
        this.port = port;
        this.dltBuffer = null;
        this.buffer = new StringTimerBuffer(STREAM_BUFFER_OPTIONS.LENGTH, STREAM_BUFFER_OPTIONS.DURATION);
        this.parser = new PacketParser();
        this.settings = this.defaultSettings(settings);
        this.buffer.on(this.buffer.EVENTS.timer, this.onBuffer.bind(this));
    }

    defaultSettings(settings) {
        if (typeof settings !== 'object' || settings === null) {
            settings = {};
        }
        typeof settings.logLevel !== 'number' && (settings.logLevel = DltLogLevel.warn);
        return settings;
    }

    open(callback) {
        this.client = new Net.connect(this.port, this.host, () => {
            // Remove error listener
            this.client.removeAllListeners();
            // Create buffer
            this.dltBuffer = new Dlt.DltBuffer();
            this.dltBuffer.on(DLT_EVENTS.packet, this.onDltPacket.bind(this));
            // Bind new listeners
            this.client.on(NET_EVENTS.close, this.onConnectionClose.bind(this));
            this.client.on(NET_EVENTS.error, this.onConnectionError.bind(this));
            this.client.on(NET_EVENTS.data, this.onConnectionData.bind(this));
            logger.debug(`Connection ${this.host}:${this.port} is established`);
            // Connection established
            callback();
        });
        this.client.on(NET_EVENTS.error, (error) => {
            logger.error(`Fail to open connection ${this.host}:${this.port}`);
            callback(error);
        });
    }

    close() {
        if (this.client === null) {
            return;
        }
        this.buffer.removeAllListeners();
        this.dltBuffer.removeAllListeners();
        this.client.removeAllListeners();
        this.client.destroy();
        this.dltBuffer = null;
        this.client = null;
        this.buffer = null;
        logger.debug(`Closing connection ${this.host}:${this.port}`);
    }

    recreateBuffer() {
        this.dltBuffer.removeAllListeners();
        this.dltBuffer = new Dlt.DltBuffer();
        this.dltBuffer.on(DLT_EVENTS.packet, this.onDltPacket.bind(this));
    }

    onConnectionClose() {
        logger.debug(`Connection ${this.host}:${this.port} is closed`);
        this.emit(HOST_CONNECTION_EVENT.close, packet);
    }

    onConnectionError(error) {
        logger.error(`Connection ${this.host}:${this.port} error: ${error.message}`);
    }

    onConnectionData(data) {
        //this.dltBuffer.buffer(data);
        //return;
        /*
            Module dlt-node gives an error:

            RangeError: Illegal offset: 0 <= 2 (+2) <= 3
            at ByteBuffer.module.exports.ByteBufferPrototype.readInt16 (./node_modules/bytebuffer/dist/bytebuffer-node.js:728:23)
            at DltBuffer.parseBuffer (./node_modules/dlt-node/dlt-buffer.js:47:30)
            at DltBuffer.buffer (./node_modules/dlt-node/dlt-buffer.js:35:14)

            has to be ticket created on github
        */
        try {
            this.dltBuffer.buffer(data);
        } catch (e) {
            logger.error(`Error during buffering income data: ${e.message}. Data: ${data.toString()}`);
            this.recreateBuffer();
        }
    }

    onDltPacket(packet) {
        if (!this.parser.isAllowedLevel(packet, this.settings.logLevel)) {
            return;
        }
        let output = this.parser.getPayloadStr(packet);
        if (output instanceof Error) {
            return logger.error(`Error during parsing packet: ${error.message}`);
        }
        if (output.trim() === '') {
            return;
        }
        this.buffer.add(output + '\n');
    }

    onBuffer(str){
        this.emit(HOST_CONNECTION_EVENT.data, str);
    }

}

class ServiceDltStream {

    constructor(){
        this.connections = new Map();
        ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_DISCONNECTED, this.onClientDisconnect.bind(this));
    }

    open(clientGUID, host, port, settings, callback){
        const addr = this.getConnectionAddr(host, port);
        const connection = this.connections.get(addr);
        // Is connection already exist
        if (typeof connection !== 'undefined') {
            // Add new client as listener
            connection.clients.push(clientGUID);
            connection.settings[clientGUID] = settings;
            this.connections.set(addr, connection);
            // Finish
            return callback();
        }
        // New connection is requeired
        const hostConnection = new HostConnection(host, port, settings);
        // Try to open connection
        hostConnection.open((error) => {
            if (error) {
                // Fail to open connection
                return callback(null, error);
            }
            // Connection is opened. Save data
            this.connections.set(addr, {
                hostConnection: hostConnection,
                clients: [clientGUID],
                settings: { [clientGUID]: settings }
            });
            // Bind connection
            hostConnection.on(HOST_CONNECTION_EVENT.data, this.onHostConnectionData.bind(this, addr));
            hostConnection.on(HOST_CONNECTION_EVENT.close, this.onHostConnectionClose.bind(this, addr));
            // Returns success status
            callback(addr, null);
        });
    }

    close(clientGUID, callback) {
        this.connections.forEach((connection, addr) => {
            if (connection.clients.indexOf(clientGUID) === -1) {
                return;
            }
            if (connection.clients.length === 1) {
                // Nobody uses connection. Destroy it.           
                connection.hostConnection.close();
                this.connections.delete(addr);
            } else {
                // Someone else uses connection.
                connection.clients.splice(connection.clients.indexOf(clientGUID),1);
                delete connection.settings[clientGUID];
                this.connections.set(addr, connection);
            }
            callback(true, null);
        });
    }

    onHostConnectionData(addr, packet) {
        const connection = this.connections.get(addr);
        if (typeof connection === 'undefined') {
            return;
        }
        connection.clients.forEach((clientGUID) => {
            ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.DltStreamData, {
                addr: addr,
                data: packet,
            });
        });
    }

    onHostConnectionClose(addr) {
        const connection = this.connections.get(addr);
        if (typeof connection === 'undefined') {
            return;
        }
        connection.clients.forEach((clientGUID) => {
            ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.DltStreamClosed, {
                addr: addr,
            });
        });
        connection.hostConnection.close();
        this.connections.delete(addr);
        logger.debug(`Connection ${addr} is closed`);
    }

    getConnectionAddr(host, port) {
        return `${host}:${port}`;
    }


    onClientDisconnect(connection, clientGUID){
        this.close(clientGUID, (state, error) => {
            if (error instanceof Error) {
                logger.error(`Error during closing connection: ${error.message}`);
            }
        });
    }

}
let serviceDltStream = new ServiceDltStream();

module.exports = serviceDltStream;

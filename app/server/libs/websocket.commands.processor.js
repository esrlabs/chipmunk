const logger            = new (require('./tools.logger'))('WebSocketProcessor');

const WebSocketEvents   = require('./websocket.events.js'),
      ServerEmitter     = require('./server.events.js');

const COMMANDS = {
    greeting                : 'greeting',
    GUIDAccepted            : 'GUIDAccepted',
    SerialData              : 'SerialData',
    WriteToSerial           : 'WriteToSerial',
    ResultWrittenToSerial   : 'ResultWrittenToSerial',
    UpdateIsAvailable       : 'UpdateIsAvailable',
    UpdateDownloadProgress  : 'UpdateDownloadProgress',
    ADBLogcatData           : 'ADBLogcatData',
    TermProcessData         : 'TermProcessData',
    TermProcessClosed       : 'TermProcessClosed',
    CallMenuItem            : 'CallMenuItem',
    DesktopModeNotification : 'DesktopModeNotification'
};

class IncomeCommandsProcessor {

    constructor(sender, GUID, eventEmitter){
        this.sender         = sender;
        this.GUID           = GUID;
        this.eventEmitter   = eventEmitter;
    }

    validate(message){
        let result = true;
        message.GUID    === void 0 && (result = false);
        message.command === void 0 && (result = false);
        message.params  === void 0 && (result = false);
        return result;
    }

    proceed(message){
        if (this.validate(message)){
            if (this[message.command] !== void 0){
                this[message.command](message);
            } else {
                logger.warning('[' + this.GUID + ']:: Next command does not support: ' + message.command);
            }
        } else {
            logger.warning('[' + this.GUID + ']:: Received message with wrong format: ' + JSON.stringify(message));
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Commands
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    [COMMANDS.greeting      ](message){
        logger.info('[' + this.GUID + ']:: GUID of current connection will be bound with client: ' + message.GUID);
        this.eventEmitter.emit(WebSocketEvents.CLIENT_GUID_IS_GOTTEN, message.GUID);
    }

    [COMMANDS.WriteToSerial ](message){
        logger.info('[' + this.GUID + ']:: Attempt to write into serial: ' + message.GUID);
        ServerEmitter.emitter.emit(ServerEmitter.EVENTS.WRITE_TO_SERIAL, this.GUID, message.params);
    }

}

class OutgoingCommandsProcessor {

    constructor(sender, GUID, eventEmitter){
        this.sender         = sender;
        this.GUID           = GUID;
        this.eventEmitter   = eventEmitter;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Commands
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    [COMMANDS.greeting](){
        this.sender({
            GUID    : '',
            command : COMMANDS.greeting,
            params  : {}
        });
    }

    [COMMANDS.GUIDAccepted](clientGUID){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.GUIDAccepted,
            params  : {}
        });
    }

    [COMMANDS.SerialData](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.SerialData,
            params  : params
        });
    }

    [COMMANDS.ResultWrittenToSerial](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.ResultWrittenToSerial,
            params  : params
        });
    }

    [COMMANDS.UpdateIsAvailable](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.UpdateIsAvailable,
            params  : params
        });
    }

    [COMMANDS.UpdateDownloadProgress](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.UpdateDownloadProgress,
            params  : params
        });
    }

    [COMMANDS.ADBLogcatData](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.ADBLogcatData,
            params  : params
        });
    }

    [COMMANDS.TermProcessData](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.TermProcessData,
            params  : params
        });
    }

    [COMMANDS.TermProcessClosed](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.TermProcessClosed,
            params  : params
        });
    }

    [COMMANDS.CallMenuItem](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.CallMenuItem,
            params  : params
        });
    }

    [COMMANDS.DesktopModeNotification](clientGUID){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.DesktopModeNotification,
            params  : {}
        });
    }

}

module.exports = {
    income      : IncomeCommandsProcessor,
    outgoing    : OutgoingCommandsProcessor,
    COMMANDS    : COMMANDS
};
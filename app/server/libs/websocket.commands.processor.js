const logger            = new (require('./tools.logger'))('WebSocketProcessor');

const WebSocketEvents   = require('./websocket.events.js'),
      ServerEmitter     = require('./server.events.js');

const COMMANDS = {
    greeting                : 'greeting',
    GUIDAccepted            : 'GUIDAccepted',
    SerialData              : 'SerialData',
    SerialScanResults       : 'SerialScanResults',
    SerialScanFinished      : 'SerialScanFinished',
    TelnetData              : 'TelnetData',
    TelnetClosed            : 'TelnetClosed',
    WriteToSerial           : 'WriteToSerial',
    WriteToTelnet           : 'WriteToTelnet',
    ResultWrittenToSerial   : 'ResultWrittenToSerial',
    ResultWrittenToTelnet   : 'ResultWrittenToTelnet',
	ResultWrittenToTerminal : 'ResultWrittenToTerminal',
	UpdateIsAvailable       : 'UpdateIsAvailable',
    UpdateIsNotAvailable    : 'UpdateIsNotAvailable',
    UpdateDownloadProgress  : 'UpdateDownloadProgress',
    ADBLogcatData           : 'ADBLogcatData',
    TermProcessData         : 'TermProcessData',
    TermProcessClosed       : 'TermProcessClosed',
    CallMenuItem            : 'CallMenuItem',
    DesktopModeNotification : 'DesktopModeNotification',
	OpenLocalFile         	: 'OpenLocalFile',
    WriteToTerminal 		: 'WriteToTerminal',
    DltStreamClosed         : 'DltStreamClosed',
    DltStreamData           : 'DltStreamData'
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

    [COMMANDS.WriteToTelnet ](message){
        logger.info('[' + this.GUID + ']:: Attempt to write into telnet: ' + message.GUID);
        ServerEmitter.emitter.emit(ServerEmitter.EVENTS.WRITE_TO_TELNET, this.GUID, message.params);
    }

	[COMMANDS.WriteToTerminal ](message){
		logger.info('[' + this.GUID + ']:: Attempt to write into terminal: ' + message.GUID);
		ServerEmitter.emitter.emit(ServerEmitter.EVENTS.WRITE_TO_TERMINAL, message.GUID, message.params);
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

    [COMMANDS.SerialScanResults](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.SerialScanResults,
            params  : params
        });
    }

    [COMMANDS.SerialScanFinished](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.SerialScanFinished,
            params  : params
        });
    }

    [COMMANDS.TelnetData](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.TelnetData,
            params  : params
        });
    }

    [COMMANDS.TelnetClosed](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.TelnetClosed,
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

    [COMMANDS.ResultWrittenToTelnet](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.ResultWrittenToTelnet,
            params  : params
        });
    }

	[COMMANDS.ResultWrittenToTerminal](clientGUID, params){
		this.sender({
			GUID    : clientGUID,
			command : COMMANDS.ResultWrittenToTerminal,
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

    [COMMANDS.UpdateIsNotAvailable](clientGUID, params){
        this.sender({
            GUID    : clientGUID,
            command : COMMANDS.UpdateIsNotAvailable,
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

	[COMMANDS.OpenLocalFile](clientGUID, params){
		this.sender({
			GUID    : clientGUID,
			command : COMMANDS.OpenLocalFile,
			params  : params
		});
	}

    [COMMANDS.DltStreamData](clientGUID, params){
		this.sender({
			GUID    : clientGUID,
			command : COMMANDS.DltStreamData,
			params  : params
		});
	}

    [COMMANDS.DltStreamClosed](clientGUID, params){
		this.sender({
			GUID    : clientGUID,
			command : COMMANDS.DltStreamClosed,
			params  : params
		});
	}

}

module.exports = {
    income      : IncomeCommandsProcessor,
    outgoing    : OutgoingCommandsProcessor,
    COMMANDS    : COMMANDS
};
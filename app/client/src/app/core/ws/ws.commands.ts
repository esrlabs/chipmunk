import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';
import { WSCommandMessage               } from './ws.message.interface';
import { Logs, TYPES                    } from '../modules/tools.logs';
import { versionController              } from "../modules/controller.version";
import { openLocalFile                  } from "../modules/tools.localfiles";

const COMMANDS = {
    greeting                : 'greeting',
    GUIDAccepted            : 'GUIDAccepted',
    SerialData              : 'SerialData',
    SerialScanResults       : 'SerialScanResults',
    SerialScanFinished      : 'SerialScanFinished',
    WriteToSerial           : 'WriteToSerial',
    ResultWrittenToSerial   : 'ResultWrittenToSerial',
    UpdateIsAvailable       : 'UpdateIsAvailable',
    UpdateIsNotAvailable    : 'UpdateIsNotAvailable',
    UpdateDownloadProgress  : 'UpdateDownloadProgress',
    ADBLogcatData           : 'ADBLogcatData',
    TermProcessData         : 'TermProcessData',
    TermProcessClosed       : 'TermProcessClosed',
    CallMenuItem            : 'CallMenuItem',
    DesktopModeNotification : 'DesktopModeNotification',
    WriteToTelnet           : 'WriteToTelnet',
    ResultWrittenToTelnet   : 'ResultWrittenToTelnet',
    TelnetData              : 'TelnetData',
    TelnetClosed            : 'TelnetClosed',
    OpenLocalFile           : 'OpenLocalFile',
    WriteToTerminal 		: 'WriteToTerminal',
    ResultWrittenToTerminal : 'ResultWrittenToTerminal'
};

class WSCommands{
    private GUID: string = null;
    private workerReady: boolean = false;
    private pending: Array<Function> = [];

    constructor(GUID: string){
        this.GUID = GUID;
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DATA_WORKER_IS_READY, this.onDATA_WORKER_IS_READY.bind(this));
    }

    proceed(message : WSCommandMessage, sender: Function){
        if (this[message.command] !== void 0){
            this[message.command](message, sender);
            return true;
        } else {
            Logs.msg(_('WebSocket server send unknown command: ') + message.command, TYPES.ERROR);
            return false;
        }
    }

    onDATA_WORKER_IS_READY(){
        this.workerReady = true;
        this.executePending();
    }

    addPending(task: Function) {
        this.pending.push(task);
    }

    executePending(){
        this.pending.forEach((task: Function) => {
           task();
        });
        this.pending = [];
    }

    safelyExecute(task: Function) {
        if (this.workerReady) {
            return task();
        }
        this.addPending(task);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Commands
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    //OUTGOING
    [COMMANDS.greeting                  ](message : WSCommandMessage, sender: Function){
        sender({
            GUID    : this.GUID,
            command : COMMANDS.greeting,
            params  : {}
        });
    }

    [COMMANDS.WriteToSerial             ](message : WSCommandMessage, sender: Function){
        sender({
            GUID    : this.GUID,
            command : COMMANDS.WriteToSerial,
            params  : message.params
        });
    }

    [COMMANDS.WriteToTelnet             ](message : WSCommandMessage, sender: Function){
        sender({
            GUID    : this.GUID,
            command : COMMANDS.WriteToTelnet,
            params  : message.params
        });
    }

    [COMMANDS.WriteToTerminal           ](message : WSCommandMessage, sender: Function){
        sender({
            GUID    : this.GUID,
            command : COMMANDS.WriteToTerminal,
            params  : message.params
        });
    }

    //INCOME
    [COMMANDS.GUIDAccepted              ](message : WSCommandMessage, sender: Function){
        if (this.GUID === message.GUID){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.API_GUID_IS_ACCEPTED, message.GUID);
            Logs.msg(_('Client GUID was accepted by server. GUID: ') + this.GUID, TYPES.DEBUG);
        } else {
            Logs.msg(_('Incorrect GUID was gotten from server. Original / from server: ') + this.GUID + ' / ' + message.GUID, TYPES.ERROR);
        }
    }

    [COMMANDS.SerialData                ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.connection === 'string' && typeof message.params.data === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SERIAL_DATA_COME, message.params);
        }
    }

    [COMMANDS.SerialScanResults         ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.statistic !== 'undefined'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SERIAL_SCAN_STATISTIC_COME, message.params.statistic);
        }
    }

    [COMMANDS.SerialScanFinished         ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.statistic !== 'undefined'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.SERIAL_SCAN_FINISHED, message.params.statistic);
        }
    }

    [COMMANDS.TelnetData                ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.connection === 'string' && typeof message.params.data === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.TELNET_DATA_COME, message.params);
        }
    }

    [COMMANDS.TelnetClosed              ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.connection === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.TELNET_CONNECTION_CLOSED, message.params);
        }
    }

    [COMMANDS.ResultWrittenToSerial     ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.serialGUID === 'string' && typeof message.params.packageGUID === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT, message.params);
        }
    }

    [COMMANDS.ResultWrittenToTelnet     ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.streamGUID === 'string' && typeof message.params.packageGUID === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_TO_TELNET_SENT, message.params);
        }
    }

    [COMMANDS.ResultWrittenToTerminal   ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.DATA_SENT_TO_TERM_PROCESS, message.params);
        }
    }

    [COMMANDS.UpdateIsAvailable         ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE, message.params);
        }
    }

    [COMMANDS.UpdateIsNotAvailable      ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.UPDATE_IS_NOT_AVAILABLE, message.params);
        }
    }

    [COMMANDS.UpdateDownloadProgress    ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS, message.params);
        }
    }

    [COMMANDS.ADBLogcatData             ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.stream === 'string' && message.params.entries instanceof Array){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.ADB_LOGCAT_DATA_COME, message.params);
        }
    }

    [COMMANDS.TermProcessData           ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.stream === 'string' && message.params.entries instanceof Array){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_DATA_COME, message.params);
        }
    }

    [COMMANDS.TermProcessClosed         ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.stream === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_CLOSED, message.params);
        }
    }

    [COMMANDS.CallMenuItem              ](message : WSCommandMessage, sender: Function){
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.handler === 'string'){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.MENU_HANDLER_CALL, message.params);
        }
    }

    [COMMANDS.DesktopModeNotification   ](message : WSCommandMessage, sender: Function){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESKTOP_MODE_NOTIFICATION);
        versionController.setAsDesktop();
    }

    [COMMANDS.OpenLocalFile             ](message : WSCommandMessage, sender: Function){
        Logs.msg('OPEN LOCAL FILE IS GOTTEN');
        this.safelyExecute(() => {
            openLocalFile(message.params.file)
                .then((data: string) => {
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, message.params.file);
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, data);
                })
                .catch((error: Error) => {
                    console.log(error.message);
                });
        });
    }


}

export { WSCommands, COMMANDS };

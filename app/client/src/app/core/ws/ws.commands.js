"use strict";
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var tools_logs_1 = require("../modules/tools.logs");
var COMMANDS = {
    greeting: 'greeting',
    GUIDAccepted: 'GUIDAccepted',
    SerialData: 'SerialData',
    WriteToSerial: 'WriteToSerial',
    ResultWrittenToSerial: 'ResultWrittenToSerial',
    UpdateIsAvailable: 'UpdateIsAvailable',
    UpdateDownloadProgress: 'UpdateDownloadProgress',
    ADBLogcatData: 'ADBLogcatData',
    TermProcessData: 'TermProcessData',
    TermProcessClosed: 'TermProcessClosed',
    CallMenuItem: 'CallMenuItem',
    DesktopModeNotification: 'DesktopModeNotification'
};
exports.COMMANDS = COMMANDS;
var WSCommands = (function () {
    function WSCommands(GUID) {
        this.GUID = null;
        this.GUID = GUID;
    }
    WSCommands.prototype.proceed = function (message, sender) {
        if (this[message.command] !== void 0) {
            this[message.command](message, sender);
            return true;
        }
        else {
            tools_logs_1.Logs.msg(_('WebSocket server send unknown command: ') + message.command, tools_logs_1.TYPES.ERROR);
            return false;
        }
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Commands
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    //OUTGOING
    WSCommands.prototype[COMMANDS.greeting] = function (message, sender) {
        sender({
            GUID: this.GUID,
            command: COMMANDS.greeting,
            params: {}
        });
    };
    WSCommands.prototype[COMMANDS.WriteToSerial] = function (message, sender) {
        sender({
            GUID: this.GUID,
            command: COMMANDS.WriteToSerial,
            params: message.params
        });
    };
    //INCOME
    WSCommands.prototype[COMMANDS.GUIDAccepted] = function (message, sender) {
        if (this.GUID === message.GUID) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.API_GUID_IS_ACCEPTED, message.GUID);
            tools_logs_1.Logs.msg(_('Client GUID was accepted by server. GUID: ') + this.GUID, tools_logs_1.TYPES.DEBUG);
        }
        else {
            tools_logs_1.Logs.msg(_('Incorrect GUID was gotten from server. Original / from server: ') + this.GUID + ' / ' + message.GUID, tools_logs_1.TYPES.ERROR);
        }
    };
    WSCommands.prototype[COMMANDS.SerialData] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.connection === 'string' && typeof message.params.data === 'string') {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SERIAL_DATA_COME, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.ResultWrittenToSerial] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.serialGUID === 'string' && typeof message.params.packageGUID === 'string') {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.UpdateIsAvailable] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.UpdateDownloadProgress] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.ADBLogcatData] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.stream === 'string' && message.params.entries instanceof Array) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADB_LOGCAT_DATA_COME, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.TermProcessData] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.stream === 'string' && message.params.entries instanceof Array) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_DATA_COME, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.TermProcessClosed] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.stream === 'string') {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_CLOSED, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.CallMenuItem] = function (message, sender) {
        if (typeof message.params === 'object' && message.params !== null && typeof message.params.handler === 'string') {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.MENU_HANDLER_CALL, message.params);
        }
    };
    WSCommands.prototype[COMMANDS.DesktopModeNotification] = function (message, sender) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESKTOP_MODE_NOTIFICATION);
    };
    return WSCommands;
}());
exports.WSCommands = WSCommands;
//# sourceMappingURL=ws.commands.js.map
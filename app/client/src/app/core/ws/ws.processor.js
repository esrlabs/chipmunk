"use strict";
var ws_commands_1 = require("./ws.commands");
var tools_logs_1 = require("../modules/tools.logs");
var WSClientProcessor = (function () {
    function WSClientProcessor(GUID) {
        this.GUID = null;
        this.commands = null;
        this.GUID = GUID;
        this.commands = new ws_commands_1.WSCommands(GUID);
    }
    WSClientProcessor.prototype.validate = function (message) {
        var result = true;
        message.GUID === void 0 && (result = false);
        message.command === void 0 && (result = false);
        message.params === void 0 && (result = false);
        return result;
    };
    WSClientProcessor.prototype.proceed = function (message, sender) {
        if (this.validate(message)) {
            return this.commands.proceed(message, sender);
        }
        else {
            tools_logs_1.Logs.msg(_('WebSocket server send not valid message.'), tools_logs_1.TYPES.ERROR);
        }
    };
    return WSClientProcessor;
}());
exports.WSClientProcessor = WSClientProcessor;
//# sourceMappingURL=ws.processor.js.map
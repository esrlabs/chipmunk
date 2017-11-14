"use strict";
var controller_config_1 = require("./controller.config");
var TYPES = {
    LOG: 'LOG',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
    LOADING: 'LOADING',
    UI: 'UI',
    MEASURE: 'MEASURE',
    EVENT_TRACKING: 'EVENT_TRACKING'
};
exports.TYPES = TYPES;
var LogMessage = (function () {
    function LogMessage(timestamp, type, msg) {
        if (timestamp === void 0) { timestamp = 0; }
        this.timestamp = timestamp;
        this.type = type;
        this.msg = msg;
    }
    return LogMessage;
}());
var Logs = (function () {
    function Logs() {
        this.logs = [];
        this.marks = {};
    }
    Logs.prototype.addAsStr = function (msg, type, console) {
        if (console === void 0) { console = false; }
        var message = new LogMessage((new Date()).getTime(), type, msg);
        this.logs.push(message);
        if (controller_config_1.configuration.sets.LOGS !== void 0 && controller_config_1.configuration.sets.LOGS.SHOW instanceof Array) {
            ~controller_config_1.configuration.sets.LOGS.SHOW.indexOf(type) && (console = true);
        }
        else {
            console = true;
        }
        console && this.console(message);
    };
    Logs.prototype.console = function (msg) {
        console.log('[' + msg.timestamp + '][' + msg.type + ']:: ' + msg.msg);
    };
    Logs.prototype.parseIncomeMsg = function (smth, type) {
        var _this = this;
        if (smth === void 0) { smth = null; }
        if (typeof smth === 'string') {
            this.addAsStr(smth, type);
        }
        else if (smth instanceof Array) {
            smth.forEach(function (smth) {
                _this.parseIncomeMsg(smth, type);
            });
        }
        else if (typeof smth === 'object' && smth !== null) {
            this.addAsStr(JSON.stringify(smth), type);
        }
        else if (smth !== null && typeof smth.toString === 'function') {
            this.addAsStr(smth.toString(), type);
        }
        else {
            this.addAsStr('Cannot recognize value of log-message', TYPES.WARNING, true);
        }
    };
    Logs.prototype.parseType = function (type) {
        if (type === void 0) { type = TYPES.LOG; }
        if (typeof type === 'string' && TYPES[type] !== void 0) {
            return TYPES[type];
        }
        else {
            this.addAsStr('Type of logs [' + type + '] does not support.', TYPES.WARNING, true);
            return TYPES.LOG;
        }
    };
    Logs.prototype.msg = function (smth, type) {
        if (smth === void 0) { smth = null; }
        if (type === void 0) { type = TYPES.LOG; }
        this.parseIncomeMsg(smth, this.parseType(type));
    };
    Logs.prototype.init = function (callback) {
        callback();
    };
    Logs.prototype.measure = function (mark) {
        typeof mark === 'string' && (mark = Symbol(mark));
        if (this.marks[mark] === void 0) {
            this.marks[mark] = performance.now();
        }
        else {
            var duration = performance.now() - this.marks[mark];
            this.msg(mark.toString().replace(/^Symbol\(/gi, '').replace(/\)$/gi, '') + ': ' + duration.toFixed(2) + 'ms; ' + (duration / 1000).toFixed(2) + 's.', TYPES.MEASURE);
            delete this.marks[mark];
        }
        return mark;
    };
    return Logs;
}());
var logs = new Logs();
exports.Logs = logs;
//# sourceMappingURL=tools.logs.js.map
"use strict";
var tools_logs_js_1 = require("../tools.logs.js");
var Generator = (function () {
    function Generator() {
        this.cacheRegs = {};
        this.history = {};
    }
    Generator.prototype.getRegExp = function (regStr) {
        try {
            this.cacheRegs[regStr] === void 0 && (this.cacheRegs[regStr] = new RegExp(regStr, 'gi'));
        }
        catch (e) {
            tools_logs_js_1.Logs.msg("Cannot create RegExp based on [" + regStr + "].", tools_logs_js_1.TYPES.ERROR);
            this.cacheRegs[regStr] = null;
        }
        return this.cacheRegs[regStr];
    };
    Generator.prototype.save = function (key, values) {
        if (this.history[key] === void 0) {
            this.history[key] = values;
        }
        else {
            tools_logs_js_1.Logs.msg("History for [" + key + "] is already saved.", tools_logs_js_1.TYPES.ERROR);
        }
    };
    Generator.prototype.load = function (key) {
        return this.history[key] !== void 0 ? this.history[key] : null;
    };
    Generator.prototype.getKey = function (GUID, segments) {
        return GUID + segments.join();
    };
    return Generator;
}());
;
var generator = new Generator();
exports.generator = generator;
//# sourceMappingURL=controller.data.parsers.tracker.generator.js.map
"use strict";
var tools_logs_1 = require("./tools.logs");
var tools_objects_merge_1 = require("./tools.objects.merge");
var SETTINGS = {
    KEY: 'logviewer.localstare'
};
var KEYs = {
    views: 'views',
    shortcuts: 'shortcuts',
    api: 'api',
    view_serialsender: 'view_serialsender',
    view_markers: 'view_markers',
    view_statemonitor: 'view_statemonitor',
    view_searchrequests: 'view_searchrequests',
    view_charts: 'view_charts',
    serial_ports: 'serial_ports',
    themes: 'themes',
    adblogccat_stream: 'adblogccat_stream'
};
exports.KEYs = KEYs;
var ControllerLocalSettings = (function () {
    function ControllerLocalSettings() {
        this.storage = {};
        this.initialize();
    }
    ControllerLocalSettings.prototype.initialize = function () {
        var storage = this.load(), valid = true;
        if (typeof storage === 'object' && storage !== null) {
            Object.keys(this.defaults()).forEach(function (key) {
                storage[key] === void 0 && (valid = false);
            });
            this.storage = valid ? storage : this.defaults();
        }
        else {
            this.storage = this.defaults();
        }
    };
    ControllerLocalSettings.prototype.defaults = function () {
        var result = {};
        Object.keys(KEYs).forEach(function (key) {
            result[key] = null;
        });
        return result;
    };
    ControllerLocalSettings.prototype.load = function () {
        var result = window.localStorage.getItem(SETTINGS.KEY);
        if (typeof result === 'string') {
            try {
                result = JSON.parse(result);
            }
            catch (e) {
                result = null;
            }
        }
        else if (typeof result !== 'object') {
            result = null;
        }
        return result;
    };
    ControllerLocalSettings.prototype.save = function () {
        window.localStorage.setItem(SETTINGS.KEY, JSON.stringify(this.storage));
    };
    ControllerLocalSettings.prototype.get = function () {
        return Object.assign({}, this.storage);
    };
    ControllerLocalSettings.prototype.set = function (data) {
        var _this = this;
        if (typeof data === 'object' && data !== null) {
            var accepted_1 = {};
            Object.keys(data).forEach(function (key) {
                if (_this.storage[key] !== void 0) {
                    accepted_1[key] = data[key];
                }
                else {
                    tools_logs_1.Logs.msg('Property [' + key + '] is not defined in default settings. Check, please, module [controller.localstorage]', tools_logs_1.TYPES.WARNING);
                }
            });
            tools_objects_merge_1.merge(this.storage, accepted_1);
            this.save();
        }
    };
    ControllerLocalSettings.prototype.reset = function (key, reason) {
        if (this.storage[key] !== void 0 && typeof reason === 'string' && reason.trim() !== '') {
            this.storage[key] = {};
            tools_logs_1.Logs.msg('Property [' + key + '] was reset by reason: ' + reason, tools_logs_1.TYPES.WARNING);
        }
        else {
            tools_logs_1.Logs.msg('Property cannot be reset without defined reason.', tools_logs_1.TYPES.WARNING);
        }
        this.save();
    };
    return ControllerLocalSettings;
}());
var localSettings = new ControllerLocalSettings();
exports.localSettings = localSettings;
//# sourceMappingURL=controller.localsettings.js.map
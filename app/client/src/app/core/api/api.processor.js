"use strict";
var api_commands_1 = require("./api.commands");
var tools_ajax_1 = require("../modules/tools.ajax");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var tools_logs_1 = require("../modules/tools.logs");
var controller_localsettings_1 = require("../modules/controller.localsettings");
var interface_configuration_sets_system_1 = require("../interfaces/interface.configuration.sets.system");
var SettingsLoader = (function () {
    function SettingsLoader() {
    }
    SettingsLoader.prototype.load = function () {
        var local = controller_localsettings_1.localSettings.get();
        if (local[controller_localsettings_1.KEYs.api] !== null) {
            return local[controller_localsettings_1.KEYs.api];
        }
        else {
            var settings_1 = {};
            Object.keys(interface_configuration_sets_system_1.SET_KEYS).forEach(function (key) {
                settings_1[interface_configuration_sets_system_1.SET_KEYS[key]] = controller_config_1.configuration.sets.SYSTEM[interface_configuration_sets_system_1.SET_KEYS[key]];
            });
            controller_localsettings_1.localSettings.set((_a = {},
                _a[controller_localsettings_1.KEYs.api] = settings_1,
                _a));
            return settings_1;
        }
        var _a;
    };
    SettingsLoader.prototype.save = function (settings) {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.api] = settings,
            _a));
        var _a;
    };
    return SettingsLoader;
}());
var APIProcessor = (function () {
    function APIProcessor() {
        this.GUID = null;
    }
    APIProcessor.prototype.validator = function (response) {
        if (typeof response === 'object' && response !== null) {
            return true;
        }
        else {
            return false;
        }
    };
    APIProcessor.prototype.onWS_SETTINGS_CHANGED = function (settings) {
        var isValid = true;
        if (typeof settings === 'object' && settings !== void 0) {
            Object.keys(interface_configuration_sets_system_1.SET_KEYS).forEach(function (key) {
                settings[key] === void 0 && (isValid = false);
            });
            if (isValid) {
                this.loader.save(settings);
                this.settings = this.loader.load();
            }
            else {
                tools_logs_1.Logs.msg('Not valid configuration come from WS_SETTINGS_CHANGED event', tools_logs_1.TYPES.WARNING);
            }
        }
        else {
            tools_logs_1.Logs.msg('Bad configuration come from WS_SETTINGS_CHANGED event', tools_logs_1.TYPES.WARNING);
        }
    };
    APIProcessor.prototype.init = function () {
        this.loader = new SettingsLoader();
        this.settings = this.loader.load();
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.API_GUID_IS_ACCEPTED, this.onAPI_GUID_IS_ACCEPTED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED, this.onWS_SETTINGS_CHANGED.bind(this));
    };
    APIProcessor.prototype.validateResponse = function (response) {
        if (typeof response === 'object' && response !== void 0) {
            if (typeof response.code === 'number' && response.output !== void 0) {
                return true;
            }
        }
        return false;
    };
    APIProcessor.prototype.send = function (command, params, callback) {
        var _this = this;
        if (this.GUID !== null) {
            if (api_commands_1.isAPICommandValid(command)) {
                var request = new tools_ajax_1.Request({
                    url: this.settings[interface_configuration_sets_system_1.SET_KEYS.API_URL],
                    method: new tools_ajax_1.Method(tools_ajax_1.DIRECTIONS.POST),
                    validator: this.validator,
                    post: {
                        GUID: this.GUID,
                        command: command,
                        params: params
                    }
                }).then(function (response) {
                    if (_this.validateResponse(response)) {
                        callback(response, null);
                    }
                    else {
                        callback(null, new Error(_('Not valid response')));
                    }
                }).catch(function (error) {
                    callback(null, error);
                });
            }
            else {
                tools_logs_1.Logs.msg(_('Unknown API command ') + '(' + command + ')', tools_logs_1.TYPES.ERROR);
                callback(null, new Error(_('Unknown API command ') + '(' + command + ')'));
            }
        }
        else {
            tools_logs_1.Logs.msg(_('Client GUID is not accepted yet.'), tools_logs_1.TYPES.ERROR);
            callback(null, new Error(_('Client GUID is not accepted yet.')));
        }
    };
    APIProcessor.prototype.onAPI_GUID_IS_ACCEPTED = function (GUID) {
        if (typeof GUID === 'string' && GUID.trim() !== '') {
            this.GUID = GUID;
        }
    };
    return APIProcessor;
}());
var processor = new APIProcessor();
exports.APIProcessor = processor;
//# sourceMappingURL=api.processor.js.map
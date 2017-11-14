"use strict";
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var tools_guid_1 = require("../modules/tools.guid");
var tools_logs_1 = require("../modules/tools.logs");
var controller_localsettings_1 = require("../modules/controller.localsettings");
var ws_processor_1 = require("../ws/ws.processor");
var ws_commands_1 = require("../ws/ws.commands");
var interface_configuration_sets_system_1 = require("../interfaces/interface.configuration.sets.system");
exports.SET_KEYS = interface_configuration_sets_system_1.SET_KEYS;
var WS_EVENTS = {
    message: 'message',
    error: 'error',
    open: 'open',
    close: 'close'
};
;
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
exports.SettingsLoader = SettingsLoader;
var WebSocketConnector = (function () {
    function WebSocketConnector() {
        var _this = this;
        this.client = null;
        this.GUID = tools_guid_1.GUID.generate();
        this.processor = null;
        this.SysEvents = [];
        this.loader = new SettingsLoader();
        this.settings = {};
        this.connected = false;
        this.SysEvents = [controller_config_1.configuration.sets.SYSTEM_EVENTS.SEND_DATA_TO_SERIAL];
        this.processor = new ws_processor_1.WSClientProcessor(this.GUID);
        this.settings = this.loader.load();
        this.SysEvents.forEach(function (event) {
            _this['on' + event] = _this['on' + event].bind(_this);
        });
        this.onWS_STATE_GET = this.onWS_STATE_GET.bind(this);
        this.onWS_SETTINGS_CHANGED = this.onWS_SETTINGS_CHANGED.bind(this);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_STATE_GET, this.onWS_STATE_GET);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED, this.onWS_SETTINGS_CHANGED);
    }
    WebSocketConnector.prototype.onWS_STATE_GET = function (callback) {
        typeof callback === 'function' && callback(this.connected);
    };
    WebSocketConnector.prototype.onWS_SETTINGS_CHANGED = function (settings) {
        var isValid = true;
        if (typeof settings === 'object' && settings !== void 0) {
            Object.keys(interface_configuration_sets_system_1.SET_KEYS).forEach(function (key) {
                settings[key] === void 0 && (isValid = false);
            });
            if (isValid) {
                this.loader.save(settings);
                this.settings = this.loader.load();
                if (this.connected) {
                    this.client.close();
                }
                else {
                    this.destroy();
                }
                this.connected = false;
                this.connect();
            }
            else {
                tools_logs_1.Logs.msg('Not valid configuration come from WS_SETTINGS_CHANGED event', tools_logs_1.TYPES.WARNING);
            }
        }
        else {
            tools_logs_1.Logs.msg('Bad configuration come from WS_SETTINGS_CHANGED event', tools_logs_1.TYPES.WARNING);
        }
    };
    WebSocketConnector.prototype.bind = function () {
        var _this = this;
        this.SysEvents.forEach(function (event) {
            controller_events_1.events.bind(event, _this['on' + event]);
        });
    };
    WebSocketConnector.prototype.unbind = function () {
        var _this = this;
        this.SysEvents.forEach(function (event) {
            controller_events_1.events.unbind(event, _this['on' + event]);
        });
    };
    WebSocketConnector.prototype.connect = function () {
        if (!this.connected) {
            tools_logs_1.Logs.msg(_('Attempt to connect to WS server: ') + this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_URL], tools_logs_1.TYPES.LOG);
            this.client = new WebSocket(this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_URL], this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_PROTOCOL]);
            this.addOriginalListeners();
            this.bind();
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_CONNECTED);
        }
    };
    WebSocketConnector.prototype.addOriginalListeners = function () {
        var _this = this;
        Object.keys(WS_EVENTS).forEach(function (event) {
            _this[WS_EVENTS[event]] = _this[WS_EVENTS[event]].bind(_this);
            _this.client.addEventListener(WS_EVENTS[event], _this[WS_EVENTS[event]]);
        });
    };
    WebSocketConnector.prototype.removeOriginalListeners = function () {
        var _this = this;
        Object.keys(WS_EVENTS).forEach(function (event) {
            _this.client.removeEventListener(WS_EVENTS[event], _this[WS_EVENTS[event]]);
        });
    };
    WebSocketConnector.prototype.destroy = function () {
        this.removeOriginalListeners();
        this.connected = false;
        this.unbind();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.connected);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED);
    };
    WebSocketConnector.prototype.getJSON = function (str) {
        var result = null;
        try {
            result = JSON.parse(str);
        }
        catch (e) {
        }
        return result;
    };
    WebSocketConnector.prototype.sendMessage = function (message) {
        this.client.send(JSON.stringify(message));
    };
    WebSocketConnector.prototype.reconnection = function () {
        tools_logs_1.Logs.msg(_('Attempt to reconnect will be done in ') + (this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_RECONNECTION_TIMEOUT] / 1000) + ' sec.', tools_logs_1.TYPES.LOG);
        this.destroy();
        setTimeout(this.connect.bind(this), this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_RECONNECTION_TIMEOUT]);
    };
    WebSocketConnector.prototype[WS_EVENTS.message] = function (event) {
        if (typeof event.data === 'string') {
            var message = this.getJSON(event.data);
            if (message !== null) {
                if (message.GUID === this.GUID || (message.GUID === '' && message.command === ws_commands_1.COMMANDS.greeting)) {
                    this.processor.proceed(message, this.sendMessage.bind(this));
                }
            }
            else {
                tools_logs_1.Logs.msg(_('WebSocket wrong message. Property data[string] is not JSON string.'), tools_logs_1.TYPES.ERROR);
            }
        }
        else {
            tools_logs_1.Logs.msg(_('WebSocket wrong message. Property data[string] is not gotten.'), tools_logs_1.TYPES.ERROR);
        }
    };
    WebSocketConnector.prototype[WS_EVENTS.open] = function (event) {
        this.connected = true;
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.connected);
    };
    WebSocketConnector.prototype[WS_EVENTS.error] = function (event) {
        var URL = event.target !== void 0 ? (event.target.url !== void 0 ? event.target.url : null) : null;
        tools_logs_1.Logs.msg(_('WebSocket error connection. Destination address: ') + (URL !== null ? URL : 'not defined'), tools_logs_1.TYPES.ERROR);
        this.reconnection();
    };
    WebSocketConnector.prototype[WS_EVENTS.close] = function (event) {
        var URL = event.target !== void 0 ? (event.target.url !== void 0 ? event.target.url : null) : null;
        tools_logs_1.Logs.msg(_('WebSocket connection was closed. Destination address: ') + (URL !== null ? URL : 'not defined'), tools_logs_1.TYPES.ERROR);
        this.reconnection();
    };
    WebSocketConnector.prototype.onSEND_DATA_TO_SERIAL = function (params) {
        this.processor.proceed({
            command: ws_commands_1.COMMANDS.WriteToSerial,
            params: params,
            GUID: this.GUID
        }, this.sendMessage.bind(this));
    };
    return WebSocketConnector;
}());
exports.WebSocketConnector = WebSocketConnector;
//# sourceMappingURL=ws.connector.js.map
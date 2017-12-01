"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var component_2 = require("../components/common/text/simple/component");
var component_3 = require("../components/common/dialogs/serial.settings/component");
var component_4 = require("../components/common/dialogs/serialports.list/component");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var controller_localsettings_1 = require("../../core/modules/controller.localsettings");
var STREAM_STATE = {
    WORKING: Symbol(),
    STOPPED: Symbol(),
    PAUSED: Symbol()
};
var BUTTONS_ICONS = {
    STOP: 'fa-stop-circle-o',
    PLAY: 'fa-play-circle-o',
    PAUSE: 'fa-pause-circle-o'
};
var BUTTONS_CAPTIONS = {
    STOP: 'stop stream',
    PLAY: 'restore stream',
    PAUSE: 'pause stream',
};
var DEFAULT_PORT_SETTINGS = {
    lock: true,
    baudRate: 921600,
    dataBits: 8,
    stopBits: 1,
    rtscts: false,
    xon: false,
    xoff: false,
    xany: false,
    bufferSize: 65536,
    vmin: 1,
    vtime: 0,
    vtransmit: 50
};
exports.DEFAULT_PORT_SETTINGS = DEFAULT_PORT_SETTINGS;
var SettingsController = (function () {
    function SettingsController() {
    }
    SettingsController.prototype.defaults = function () {
        return Object.assign({}, DEFAULT_PORT_SETTINGS);
    };
    SettingsController.prototype.load = function (port) {
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.serial_ports] !== void 0 && settings[controller_localsettings_1.KEYs.serial_ports] !== null && settings[controller_localsettings_1.KEYs.serial_ports][port] !== void 0) {
            return Object.assign({}, settings[controller_localsettings_1.KEYs.serial_ports][port]);
        }
        else {
            return this.defaults();
        }
    };
    SettingsController.prototype.save = function (port, settings) {
        if (typeof settings === 'object' && settings !== null) {
            controller_localsettings_1.localSettings.set((_a = {},
                _a[controller_localsettings_1.KEYs.serial_ports] = (_b = {},
                    _b[port] = settings,
                    _b),
                _a));
        }
        var _a, _b;
    };
    return SettingsController;
}());
var SerialStream = (function () {
    function SerialStream(connection, port) {
        this.connection = null;
        this.port = null;
        this.state = STREAM_STATE.WORKING;
        this.buffer = '';
        this.buttons = {
            STOP: Symbol(),
            PLAYPAUSE: Symbol()
        };
        this.connection = connection;
        this.port = port;
        this.onData = this.onData.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onPause = this.onPause.bind(this);
        this.onStreamReset = this.onStreamReset.bind(this);
        this.onReadyToSendData = this.onReadyToSendData.bind(this);
        this.onLostConnection = this.onLostConnection.bind(this);
        this.addButtonsInToolBar();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, this.port);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, '');
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SERIAL_DATA_COME, this.onData);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onStreamReset);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL, this.onReadyToSendData);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.onLostConnection);
    }
    SerialStream.prototype.addButtonsInToolBar = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id: this.buttons.STOP, icon: BUTTONS_ICONS.STOP, caption: BUTTONS_CAPTIONS.STOP, handle: this.onStop, enable: true },
            { id: this.buttons.PLAYPAUSE, icon: BUTTONS_ICONS.PAUSE, caption: BUTTONS_CAPTIONS.PAUSE, handle: this.onPause, enable: true },
        ]);
    };
    SerialStream.prototype.destroy = function () {
        var _this = this;
        //Unbind events
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SERIAL_DATA_COME, this.onData);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onStreamReset);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL, this.onReadyToSendData);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.onLostConnection);
        //Kill buttons
        Object.keys(this.buttons).forEach(function (button) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, _this.buttons[button]);
        });
        //Reset titles
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
    };
    SerialStream.prototype.onStreamReset = function () {
        this.onStop();
    };
    SerialStream.prototype.onStop = function () {
        if (this.state !== STREAM_STATE.STOPPED) {
            var processor = api_processor_1.APIProcessor;
            this.state = STREAM_STATE.STOPPED;
            processor.send(api_commands_1.APICommands.closeSerialStream, {
                port: this.port,
                connection: this.connection
            }, this.onStopped.bind(this));
        }
    };
    SerialStream.prototype.onStopped = function (response) {
        this.destroy();
    };
    SerialStream.prototype.onPause = function () {
        var alias = null;
        switch (this.state) {
            case STREAM_STATE.WORKING:
                this.state = STREAM_STATE.PAUSED;
                alias = 'PLAY';
                break;
            case STREAM_STATE.PAUSED:
                this.state = STREAM_STATE.WORKING;
                alias = 'PAUSE';
                this.onData({
                    connection: this.connection,
                    data: ''
                });
                break;
        }
        alias !== null && controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, {
            id: this.buttons.PLAYPAUSE,
            icon: BUTTONS_ICONS[alias],
            caption: BUTTONS_CAPTIONS[alias]
        });
    };
    SerialStream.prototype.onData = function (params) {
        if (this.connection === params.connection) {
            switch (this.state) {
                case STREAM_STATE.WORKING:
                    this.buffer += params.data;
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.buffer);
                    this.buffer = '';
                    break;
                case STREAM_STATE.PAUSED:
                    this.buffer += params.data;
                    break;
                case STREAM_STATE.STOPPED:
                    break;
            }
        }
    };
    SerialStream.prototype.onReadyToSendData = function (params) {
        if (params.packageGUID !== void 0 && params.buffer !== void 0) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEND_DATA_TO_SERIAL, {
                packageGUID: params.packageGUID,
                port: this.port,
                serialGUID: this.connection,
                buffer: params.buffer
            });
        }
    };
    SerialStream.prototype.onLostConnection = function () {
        this.destroy();
    };
    return SerialStream;
}());
var OpenSerialStream = (function () {
    function OpenSerialStream() {
        this.GUID = Symbol();
        this.progressGUID = Symbol();
        this.processor = api_processor_1.APIProcessor;
        this.port = null;
        this.connection = null;
        this.Settings = new SettingsController();
    }
    OpenSerialStream.prototype.start = function () {
        this.getListPorts();
    };
    OpenSerialStream.prototype.getListPorts = function () {
        this.showProgress(_('Please wait... Getting list of available ports.'));
        this.processor.send(api_commands_1.APICommands.serialPortsList, {}, this.onListOfPorts.bind(this));
    };
    OpenSerialStream.prototype.onListOfPorts = function (response, error) {
        this.hidePopup(this.progressGUID);
        if (error === null) {
            if (response.code === 0 && response.output instanceof Array) {
                this.showList(response.output);
            }
            else {
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
    };
    OpenSerialStream.prototype.outputToString = function (output) {
        if (typeof output === 'string') {
            return output;
        }
        else if (typeof output === 'number') {
            return output.toString();
        }
        else if (typeof output === 'object') {
            return JSON.stringify(output);
        }
    };
    OpenSerialStream.prototype.openSerialPort = function (port, settings) {
        this.showProgress(_('Please wait... Opening ') + port);
        this.port = port;
        this.processor.send(api_commands_1.APICommands.openSerialPort, {
            port: port,
            settings: settings
        }, this.onOpenSerialPort.bind(this));
    };
    OpenSerialStream.prototype.onOpenSerialPort = function (response, error) {
        this.hidePopup(this.progressGUID);
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'string') {
                //Everything is cool.
                this.connection = response.output;
                this.attachSerialStream();
            }
            else {
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
    };
    OpenSerialStream.prototype.showSettings = function (port) {
        var GUID = Symbol();
        var settings = this.Settings.load(port);
        var params = Object.assign({
            proceed: function (GUID, port, settings) {
                this.Settings.save(port, settings);
                this.hidePopup(GUID);
                this.openSerialPort(port, settings);
            }.bind(this, GUID, port),
            cancel: function (GUID, port) {
                this.hidePopup(GUID);
            }.bind(this, GUID, port)
        }, settings);
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_3.DialogSerialSettings,
                params: params
            },
            title: _('Configuration of connection: ') + port,
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '35rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    OpenSerialStream.prototype.showList = function (list) {
        var GUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_4.DialogSerialPortsList,
                params: {
                    ports: list.map(function (item) {
                        return {
                            name: item.comName,
                            id: item.comName
                        };
                    }),
                    handler: function (GUID, portID, settings) {
                        var settingsController = new SettingsController();
                        this.hidePopup(GUID);
                        settings ? this.showSettings(portID) : this.openSerialPort(portID, settingsController.load(portID));
                    }.bind(this, GUID)
                }
            },
            title: _('Available ports'),
            settings: {
                move: true,
                resize: true,
                width: '20rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    OpenSerialStream.prototype.showMessage = function (title, message) {
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.SimpleText,
                params: {
                    text: message
                }
            },
            title: title,
            settings: {
                move: true,
                resize: true,
                width: '20rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: Symbol()
        });
    };
    OpenSerialStream.prototype.showProgress = function (caption) {
        this.progressGUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ProgressBarCircle,
                params: {}
            },
            title: caption,
            settings: {
                move: false,
                resize: false,
                width: '20rem',
                height: '10rem',
                close: false,
                addCloseHandle: false,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: this.progressGUID
        });
    };
    OpenSerialStream.prototype.hidePopup = function (GUID) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    };
    OpenSerialStream.prototype.closeSerial = function (connection, port) {
    };
    OpenSerialStream.prototype.attachSerialStream = function () {
        var serialStream = new SerialStream(this.connection, this.port);
    };
    return OpenSerialStream;
}());
exports.OpenSerialStream = OpenSerialStream;
//# sourceMappingURL=handle.open.serial.stream.js.map
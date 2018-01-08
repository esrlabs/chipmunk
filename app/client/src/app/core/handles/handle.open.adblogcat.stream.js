"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var component_2 = require("../components/common/text/simple/component");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var component_3 = require("../components/common/dialogs/adblogcat.settings/component");
var component_4 = require("../components/common/dialogs/dialog-message/component");
var controller_localsettings_1 = require("../../core/modules/controller.localsettings");
var STREAM_STATE = {
    WORKING: Symbol(),
    STOPPED: Symbol(),
    PAUSED: Symbol(),
};
var BUTTONS_ICONS = {
    STOP: 'fa-stop-circle-o',
    PLAY: 'fa-play-circle-o',
    PAUSE: 'fa-pause-circle-o',
    SETTINGS: 'fa-gear'
};
var BUTTONS_CAPTIONS = {
    STOP: 'stop stream',
    PLAY: 'restore stream',
    PAUSE: 'pause stream',
    SETTINGS: 'settings of stream'
};
var ERRORS = {
    ADB_SPAWN_01: 'ADB_SPAWN_01'
};
var DEFAULT_STREAM_SETTINGS = {
    levels: {
        V: true,
        I: true,
        F: true,
        W: true,
        E: true,
        D: true,
        S: true
    },
    tid: -1,
    pid: -1,
    path: '',
    reset: true
};
var SettingsController = (function () {
    function SettingsController() {
    }
    SettingsController.prototype.defaults = function () {
        return Object.assign({}, DEFAULT_STREAM_SETTINGS);
    };
    SettingsController.prototype.load = function () {
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.adblogccat_stream] !== void 0 && settings[controller_localsettings_1.KEYs.adblogccat_stream] !== null) {
            return Object.assign({}, this.verify(settings[controller_localsettings_1.KEYs.adblogccat_stream], this.defaults()));
        }
        else {
            return this.defaults();
        }
    };
    SettingsController.prototype.save = function (settings) {
        if (typeof settings === 'object' && settings !== null) {
            controller_localsettings_1.localSettings.set((_a = {},
                _a[controller_localsettings_1.KEYs.adblogccat_stream] = settings,
                _a));
        }
        var _a;
    };
    SettingsController.prototype.verify = function (settings, defaults) {
        var _this = this;
        Object.keys(defaults).forEach(function (key) {
            if (typeof defaults[key] !== typeof settings[key]) {
                settings[key] = defaults[key];
            }
            if (typeof settings[key] === 'object' && settings[key] !== null && !(settings[key] instanceof Array)) {
                settings[key] = _this.verify(settings[key], defaults[key]);
            }
        });
        return settings;
    };
    SettingsController.prototype.convert = function (settings) {
        var tags = [];
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach(function (key) {
            settings.levels[key] && tags.push(key);
        });
        return {
            pid: settings.pid > 0 ? settings.pid.toString() : '',
            tid: settings.tid > 0 ? settings.tid.toString() : '',
            tags: tags.length === 7 ? null : tags,
            path: settings.path,
            reset: settings.reset
        };
    };
    return SettingsController;
}());
var LogcatStream = (function () {
    function LogcatStream(stream) {
        this.Settings = new SettingsController();
        this.processor = api_processor_1.APIProcessor;
        this.state = STREAM_STATE.WORKING;
        this.buffer = '';
        this.stream = null;
        this.buttons = {
            STOP: Symbol(),
            PLAYPAUSE: Symbol(),
            SETTINGS: Symbol()
        };
        this.stream = stream;
        this.onData = this.onData.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onPause = this.onPause.bind(this);
        this.onStreamReset = this.onStreamReset.bind(this);
        this.onLostConnection = this.onLostConnection.bind(this);
        this.onSettings = this.onSettings.bind(this);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, 'ADB Logcat');
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, '');
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADB_LOGCAT_DATA_COME, this.onData);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onStreamReset);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.onLostConnection);
        this.addButtonsInToolBar();
    }
    LogcatStream.prototype.addButtonsInToolBar = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id: this.buttons.STOP, icon: BUTTONS_ICONS.STOP, caption: BUTTONS_CAPTIONS.STOP, handle: this.onStop, enable: true },
            { id: this.buttons.PLAYPAUSE, icon: BUTTONS_ICONS.PAUSE, caption: BUTTONS_CAPTIONS.PAUSE, handle: this.onPause, enable: true },
            { id: this.buttons.SETTINGS, icon: BUTTONS_ICONS.SETTINGS, caption: BUTTONS_CAPTIONS.SETTINGS, handle: this.onSettings, enable: true },
        ]);
    };
    LogcatStream.prototype.destroy = function () {
        var _this = this;
        //Unbind events
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADB_LOGCAT_DATA_COME, this.onData);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onStreamReset);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.onLostConnection);
        //Kill buttons
        Object.keys(this.buttons).forEach(function (button) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, _this.buttons[button]);
        });
        //Reset titles
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
    };
    LogcatStream.prototype.onStop = function () {
        if (this.state !== STREAM_STATE.STOPPED) {
            var processor = api_processor_1.APIProcessor;
            this.state = STREAM_STATE.STOPPED;
            processor.send(api_commands_1.APICommands.closeLogcatStream, {
                stream: this.stream
            }, this.onStopped.bind(this));
        }
    };
    LogcatStream.prototype.onStopped = function (response) {
        this.destroy();
    };
    LogcatStream.prototype.onPause = function () {
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
                    stream: this.stream,
                    entries: []
                });
                break;
        }
        alias !== null && controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, {
            id: this.buttons.PLAYPAUSE,
            icon: BUTTONS_ICONS[alias],
            caption: BUTTONS_CAPTIONS[alias]
        });
    };
    LogcatStream.prototype.onSettings = function () {
        var GUID = Symbol();
        var settings = this.Settings.load();
        var params = Object.assign({}, settings.levels);
        params.tid = settings.tid;
        params.pid = settings.pid;
        params.path = settings.path;
        params.reset = settings.reset;
        params.proceed = this.onApplySettings.bind(this, GUID);
        params.cancel = this.onCancelSettings.bind(this, GUID);
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_3.DialogADBLogcatStreamSettings,
                params: params
            },
            title: _('Configuration of ADB logcat stream: '),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '40rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    LogcatStream.prototype.onApplySettings = function (GUID, settings) {
        this.Settings.save(settings);
        this.applySettings(this.Settings.convert(settings));
        this.hidePopup(GUID);
    };
    LogcatStream.prototype.applySettings = function (settings) {
        this.processor.send(api_commands_1.APICommands.setSettingsLogcatStream, {
            settings: settings
        }, function () {
        });
    };
    LogcatStream.prototype.onCancelSettings = function (GUID) {
        this.hidePopup(GUID);
    };
    LogcatStream.prototype.hidePopup = function (GUID) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    };
    LogcatStream.prototype.onStreamReset = function () {
        this.onStop();
    };
    LogcatStream.prototype.onData = function (params) {
        if (this.stream === params.stream) {
            switch (this.state) {
                case STREAM_STATE.WORKING:
                    this.buffer += params.entries.map(function (entry) { return entry.original; }).join('\n') + '\n';
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.buffer);
                    this.buffer = '';
                    break;
                case STREAM_STATE.PAUSED:
                    this.buffer += params.entries.map(function (entry) { return entry.original; }).join('\n');
                    break;
                case STREAM_STATE.STOPPED:
                    break;
            }
        }
    };
    LogcatStream.prototype.onLostConnection = function () {
        this.destroy();
    };
    return LogcatStream;
}());
var OpenADBLogcatStream = (function () {
    function OpenADBLogcatStream() {
        this.GUID = Symbol();
        this.progressGUID = Symbol();
        this.processor = api_processor_1.APIProcessor;
        this.listening = false;
        this.Settings = new SettingsController();
    }
    OpenADBLogcatStream.prototype.start = function () {
        this.openStream();
    };
    OpenADBLogcatStream.prototype.openStream = function () {
        this.showProgress(_('Please wait... Opening...'));
        var settings = this.Settings.load();
        this.processor.send(api_commands_1.APICommands.openLogcatStream, {
            settings: this.Settings.convert(settings)
        }, this.onStreamOpened.bind(this));
    };
    OpenADBLogcatStream.prototype.onStreamOpened = function (response, error) {
        this.hidePopup(this.progressGUID);
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'string') {
                //Everything is cool.
                this.listening = true;
                this.attachStream(response.output);
            }
            else {
                if (~response.output.indexOf(ERRORS.ADB_SPAWN_01)) {
                    this.showPromptToSettings();
                }
                else {
                    this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
                }
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
    };
    OpenADBLogcatStream.prototype.attachStream = function (stream) {
        var logcatStream = new LogcatStream(stream);
    };
    OpenADBLogcatStream.prototype.outputToString = function (output) {
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
    OpenADBLogcatStream.prototype.showMessage = function (title, message) {
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
    OpenADBLogcatStream.prototype.showProgress = function (caption) {
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
    OpenADBLogcatStream.prototype.showPromptToSettings = function () {
        var _this = this;
        var guid = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_4.DialogMessage,
                params: {
                    message: 'It looks like LogViewer cannot find adb SDK. You can open settings of ADB Logcat and define direct path to adb SDK. Be sure, that you have installed adb SDK on your system.',
                    buttons: [
                        {
                            caption: 'Open settings',
                            handle: this.showSettings.bind(this, guid)
                        },
                        {
                            caption: 'Close',
                            handle: function () {
                                _this.hidePopup(guid);
                            }
                        }
                    ]
                }
            },
            title: 'Cannot find adb SDK',
            settings: {
                move: true,
                resize: true,
                width: '30rem',
                height: '15rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: guid
        });
    };
    OpenADBLogcatStream.prototype.showSettings = function () {
        var GUID = Symbol();
        var settings = this.Settings.load();
        var params = Object.assign({}, settings.levels);
        params.tid = settings.tid;
        params.pid = settings.pid;
        params.path = settings.path;
        params.reset = settings.reset;
        params.proceed = this.onApplySettings.bind(this, GUID);
        params.cancel = this.onCancelSettings.bind(this, GUID);
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_3.DialogADBLogcatStreamSettings,
                params: params
            },
            title: _('Configuration of ADB logcat stream: '),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '40rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    OpenADBLogcatStream.prototype.onApplySettings = function (GUID, settings) {
        this.Settings.save(settings);
        this.openStream();
        this.hidePopup(GUID);
    };
    OpenADBLogcatStream.prototype.onCancelSettings = function (GUID) {
        this.hidePopup(GUID);
    };
    OpenADBLogcatStream.prototype.hidePopup = function (GUID) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    };
    return OpenADBLogcatStream;
}());
exports.OpenADBLogcatStream = OpenADBLogcatStream;
//# sourceMappingURL=handle.open.adblogcat.stream.js.map
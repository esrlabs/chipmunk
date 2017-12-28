"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var component_2 = require("../components/common/text/simple/component");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var component_3 = require("../components/common/dialogs/terminal.open/component");
var STREAM_STATE = {
    WORKING: Symbol(),
    STOPPED: Symbol(),
    PAUSED: Symbol(),
};
var BUTTONS_ICONS = {
    STOP: 'fa-stop-circle-o',
    PLAY: 'fa-play-circle-o',
    PAUSE: 'fa-pause-circle-o',
};
var BUTTONS_CAPTIONS = {
    STOP: 'stop stream',
    PLAY: 'restore stream',
    PAUSE: 'pause stream',
};
var ERRORS = {
    EXECUTING_ERROR: 'EXECUTING_ERROR'
};
var TerminalStream = (function () {
    function TerminalStream(stream) {
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
        this.onClose = this.onClose.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onPause = this.onPause.bind(this);
        this.onStreamReset = this.onStreamReset.bind(this);
        this.onLostConnection = this.onLostConnection.bind(this);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, 'Terminal stream');
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, '');
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_DATA_COME, this.onData);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_CLOSED, this.onClose);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onStreamReset);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.onLostConnection);
        this.addButtonsInToolBar();
    }
    TerminalStream.prototype.addButtonsInToolBar = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id: this.buttons.STOP, icon: BUTTONS_ICONS.STOP, caption: BUTTONS_CAPTIONS.STOP, handle: this.onStop, enable: true },
            { id: this.buttons.PLAYPAUSE, icon: BUTTONS_ICONS.PAUSE, caption: BUTTONS_CAPTIONS.PAUSE, handle: this.onPause, enable: true },
        ]);
    };
    TerminalStream.prototype.destroy = function () {
        var _this = this;
        //Unbind events
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_DATA_COME, this.onData);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_CLOSED, this.onClose);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onStreamReset);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.onLostConnection);
        //Kill buttons
        Object.keys(this.buttons).forEach(function (button) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, _this.buttons[button]);
        });
        //Reset titles
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
    };
    TerminalStream.prototype.onClose = function (params) {
        if (this.stream === params.stream) {
            this.onStopped(null);
        }
    };
    TerminalStream.prototype.onStop = function () {
        if (this.state !== STREAM_STATE.STOPPED) {
            var processor = api_processor_1.APIProcessor;
            this.state = STREAM_STATE.STOPPED;
            processor.send(api_commands_1.APICommands.closeProcessStream, {
                stream: this.stream
            }, this.onStopped.bind(this));
        }
    };
    TerminalStream.prototype.onStopped = function (response) {
        this.destroy();
    };
    TerminalStream.prototype.onPause = function () {
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
    TerminalStream.prototype.onStreamReset = function () {
        this.onStop();
    };
    TerminalStream.prototype.onData = function (params) {
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
    TerminalStream.prototype.onLostConnection = function () {
        this.destroy();
    };
    return TerminalStream;
}());
var OpenTerminalStream = (function () {
    function OpenTerminalStream() {
        this.GUID = Symbol();
        this.progressGUID = Symbol();
        this.processor = api_processor_1.APIProcessor;
        this.listening = false;
        this.stream = null;
        /*
        this.onShortcutOpen = this.onShortcutOpen.bind(this);
        Events.bind(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TERMINAL_COMMAND,  this.onShortcutOpen);
        */
    }
    OpenTerminalStream.prototype.onShortcutOpen = function () {
        this.showOpen();
    };
    OpenTerminalStream.prototype.start = function () {
        this.showOpen();
    };
    OpenTerminalStream.prototype.openStream = function (params) {
        this.showProgress(_('Please wait... Opening...'));
        this.closeStream();
        this.processor.send(api_commands_1.APICommands.openProcessStream, {
            alias: params.alias,
            parameters: params.parameters,
            keywords: params.keywords
        }, this.onStreamOpened.bind(this));
    };
    OpenTerminalStream.prototype.onStreamOpened = function (response, error) {
        this.hidePopup(this.progressGUID);
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'string') {
                //Everything is cool.
                this.listening = true;
                this.attachStream(response.output);
            }
            else {
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
    };
    OpenTerminalStream.prototype.closeStream = function () {
        if (this.stream !== null) {
            this.stream.onStop();
            this.stream = null;
        }
    };
    OpenTerminalStream.prototype.attachStream = function (stream) {
        this.stream = new TerminalStream(stream);
    };
    OpenTerminalStream.prototype.outputToString = function (output) {
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
    OpenTerminalStream.prototype.showMessage = function (title, message) {
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
    OpenTerminalStream.prototype.showProgress = function (caption) {
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
    OpenTerminalStream.prototype.showOpen = function () {
        var GUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_3.DialogTerminalStreamOpen,
                params: {
                    alias: '',
                    path: '',
                    keywords: '',
                    proceed: this.onApplyOpen.bind(this, GUID),
                    cancel: this.onCancelOpen.bind(this, GUID)
                }
            },
            title: _('Opening terminal stream: '),
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
    OpenTerminalStream.prototype.onApplyOpen = function (GUID, data) {
        this.hidePopup(GUID);
        var parts = data.alias.split(' ');
        if (parts.length === 0) {
            return false;
        }
        var params = {
            alias: parts[0],
            parameters: parts.length > 1 ? parts.splice(1, parts.length) : [],
            keywords: data.keywords.split(';')
        };
        if (params.alias.trim() === '') {
            return false;
        }
        this.openStream(params);
    };
    OpenTerminalStream.prototype.onCancelOpen = function (GUID) {
        this.hidePopup(GUID);
    };
    OpenTerminalStream.prototype.hidePopup = function (GUID) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    };
    return OpenTerminalStream;
}());
exports.OpenTerminalStream = OpenTerminalStream;
//# sourceMappingURL=handle.open.terminal.stream.js.map
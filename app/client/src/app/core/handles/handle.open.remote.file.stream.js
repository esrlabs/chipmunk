"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var component_2 = require("../components/common/dialogs/dialog-a/component");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var OpenRemoteFileStream = (function () {
    function OpenRemoteFileStream() {
        this.GUID = Symbol();
        this.progressGUID = Symbol();
        this.processor = api_processor_1.APIProcessor;
    }
    OpenRemoteFileStream.prototype.showProgress = function () {
        this.progressGUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ProgressBarCircle,
                params: {}
            },
            title: 'Please, wait...',
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
    OpenRemoteFileStream.prototype.hideProgress = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.progressGUID);
    };
    OpenRemoteFileStream.prototype.dialog = function () {
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.DialogA,
                params: {
                    caption: 'Path and filename of target',
                    value: '',
                    type: 'text',
                    placeholder: 'type filename and path to',
                    buttons: [
                        {
                            caption: 'Open',
                            handle: function () {
                                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.GUID);
                                this.sendRequest('test');
                            }.bind(this)
                        },
                        {
                            caption: 'Cancel',
                            handle: function () {
                                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.GUID);
                            }.bind(this)
                        }
                    ]
                }
            },
            title: 'Open ',
            settings: {
                move: true,
                resize: false,
                width: '25rem',
                height: '15rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: this.GUID
        });
    };
    OpenRemoteFileStream.prototype.sendRequest = function (src) {
        this.showProgress();
        this.processor.send(api_commands_1.APICommands.OPEN_FILE_STREAM, {
            src: src,
            type: 'pipe'
        }, this.onResponse.bind(this));
    };
    OpenRemoteFileStream.prototype.onResponse = function (response, error) {
        console.log(response);
        this.hideProgress();
    };
    return OpenRemoteFileStream;
}());
exports.OpenRemoteFileStream = OpenRemoteFileStream;
//# sourceMappingURL=handle.open.remote.file.stream.js.map
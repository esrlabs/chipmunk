"use strict";
var controller_1 = require("../components/common/fileloader/controller");
var controller_2 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var handle_open_remote_file_stream_1 = require("../handles/handle.open.remote.file.stream");
var handle_open_serial_stream_1 = require("../handles/handle.open.serial.stream");
var handle_open_adblogcat_stream_1 = require("../handles/handle.open.adblogcat.stream");
var handle_open_terminal_stream_1 = require("../handles/handle.open.terminal.stream");
var handle_add_view_1 = require("../handles/handle.add.view");
var handle_api_settings_1 = require("../handles/handle.api.settings");
var controller_themes_1 = require("../modules/controller.themes");
var TopBarMenuHandles = (function () {
    function TopBarMenuHandles() {
    }
    TopBarMenuHandles.prototype.openLocalFile = function () {
        function ShowWaitPopup() {
            GUID = Symbol();
            controller_2.popupController.open({
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
                GUID: GUID
            });
        }
        var GUID = null;
        controller_1.fileLoaderController.open(Symbol(), {
            load: function (data, files) {
                if (files instanceof FileList) {
                    var description_1 = '';
                    Array.prototype.forEach.call(files, function (file) {
                        description_1 += (description_1 !== '' ? '; ' : '') + file.name + ' (' + Math.round(file.size / 1024) + ' kB)';
                    });
                    description_1 = 'Files: ' + description_1;
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, description_1);
                }
                GUID === null && ShowWaitPopup();
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, data, function () {
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
                });
            },
            error: function (event) {
            },
            reading: function (file) {
                ShowWaitPopup();
            }
        });
    };
    TopBarMenuHandles.prototype.openRemoteFileStream = function () {
        var openRemoteFileStream = new handle_open_remote_file_stream_1.OpenRemoteFileStream();
        openRemoteFileStream.dialog();
    };
    TopBarMenuHandles.prototype.openSerialStream = function () {
        var openSerialStream = new handle_open_serial_stream_1.OpenSerialStream();
        openSerialStream.start();
    };
    TopBarMenuHandles.prototype.openADBLogcatStream = function () {
        var openADBLogcatStream = new handle_open_adblogcat_stream_1.OpenADBLogcatStream();
        openADBLogcatStream.start();
    };
    TopBarMenuHandles.prototype.openTerminalCommand = function () {
        var openTerminalStream = new handle_open_terminal_stream_1.OpenTerminalStream();
        openTerminalStream.start();
    };
    TopBarMenuHandles.prototype.connectionSettings = function () {
        var APIsettings = new handle_api_settings_1.APISettings();
        APIsettings.dialog();
    };
    TopBarMenuHandles.prototype.changeThemeSettings = function () {
        controller_themes_1.controllerThemes.oneSelectThemeDialog();
    };
    TopBarMenuHandles.prototype.addView = function () {
        var addView = new handle_add_view_1.AddView();
        addView.start();
    };
    TopBarMenuHandles.prototype.openProgressBar = function () {
    };
    return TopBarMenuHandles;
}());
var topbarMenuHandles = new TopBarMenuHandles();
exports.topbarMenuHandles = topbarMenuHandles;
//# sourceMappingURL=topbar.menu.hadles.js.map
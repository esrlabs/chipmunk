"use strict";
var controller_events_1 = require("./controller.events");
var controller_config_1 = require("./controller.config");
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/dialogs/update/component");
var Updater = (function () {
    function Updater() {
        this.dialogGUID = null;
        this.info = null;
        this.state = null;
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE, this.UPDATE_IS_AVAILABLE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS, this.UPDATE_DOWNLOAD_PROGRESS.bind(this));
    }
    Updater.prototype.UPDATE_IS_AVAILABLE = function (info) {
        this.info = info;
        this.openDialog();
    };
    Updater.prototype.UPDATE_DOWNLOAD_PROGRESS = function (state) {
        this.state = state;
        this.openDialog();
    };
    Updater.prototype.openDialog = function () {
        if (this.dialogGUID === null) {
            this.dialogGUID = Symbol();
            controller_1.popupController.open({
                content: {
                    factory: null,
                    component: component_1.DialogUpdate,
                    params: {
                        info: this.info !== null ? (this.info.info !== void 0 ? this.info.info : null) : null,
                        progress: this.state !== null ? (this.state.progress !== void 0 ? this.state.progress : null) : null,
                        speed: this.state !== null ? (this.state.speed !== void 0 ? this.state.speed : null) : null
                    }
                },
                title: _('Updating'),
                settings: {
                    move: true,
                    resize: true,
                    width: '30rem',
                    height: '10rem',
                    close: true,
                    addCloseHandle: true,
                    css: ''
                },
                buttons: [],
                titlebuttons: [],
                GUID: this.dialogGUID
            });
        }
    };
    return Updater;
}());
exports.Updater = Updater;
//# sourceMappingURL=controller.updater.js.map
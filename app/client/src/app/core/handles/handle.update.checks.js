"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var component_2 = require("../components/common/text/simple/component");
var UpdateChecks = (function () {
    function UpdateChecks() {
        this.processor = api_processor_1.APIProcessor;
        this.progressGUID = null;
    }
    UpdateChecks.prototype.start = function () {
        var _this = this;
        this.showProgress('Please, wait...');
        this.processor.send(api_commands_1.APICommands.checkUpdates, {}, function (response, error) {
            _this.hideProgress();
            console.log(response);
            console.log(error);
        });
    };
    UpdateChecks.prototype.showMessage = function (title, message) {
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
    UpdateChecks.prototype.showProgress = function (caption) {
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
    UpdateChecks.prototype.hideProgress = function () {
        if (this.progressGUID !== null) {
            controller_1.popupController.close(this.progressGUID);
            this.progressGUID = null;
        }
    };
    return UpdateChecks;
}());
exports.UpdateChecks = UpdateChecks;
//# sourceMappingURL=handle.update.checks.js.map
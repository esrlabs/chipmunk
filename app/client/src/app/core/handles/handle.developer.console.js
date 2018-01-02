"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var DeveloperConsole = (function () {
    function DeveloperConsole() {
        this.processor = api_processor_1.APIProcessor;
        this.progressGUID = null;
    }
    DeveloperConsole.prototype.start = function () {
        var _this = this;
        this.showProgress('Please, wait...');
        this.processor.send(api_commands_1.APICommands.openDevConsole, {}, function (response, error) {
            _this.hideProgress();
        });
    };
    DeveloperConsole.prototype.showProgress = function (caption) {
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
    DeveloperConsole.prototype.hideProgress = function () {
        if (this.progressGUID !== null) {
            controller_1.popupController.close(this.progressGUID);
            this.progressGUID = null;
        }
    };
    return DeveloperConsole;
}());
exports.DeveloperConsole = DeveloperConsole;
//# sourceMappingURL=handle.developer.console.js.map
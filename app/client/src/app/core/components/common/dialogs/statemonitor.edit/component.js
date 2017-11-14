"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require("@angular/core");
var controller_events_1 = require("../../../../modules/controller.events");
var controller_config_1 = require("../../../../modules/controller.config");
var DialogStatemonitorEditJSON = (function () {
    function DialogStatemonitorEditJSON(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.json = '';
        this.callback = null;
        this.error = false;
        this.onSave = this.onSave.bind(this);
    }
    DialogStatemonitorEditJSON.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    DialogStatemonitorEditJSON.prototype.onKeyPress = function (event) {
    };
    DialogStatemonitorEditJSON.prototype.onFocus = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
    };
    DialogStatemonitorEditJSON.prototype.onBlur = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
    };
    DialogStatemonitorEditJSON.prototype.onKeyUp = function (event) {
        this.error = false;
        this.forceUpdate();
    };
    DialogStatemonitorEditJSON.prototype.onKeyDown = function (event) {
    };
    DialogStatemonitorEditJSON.prototype.onSave = function () {
        try {
            var result = JSON.parse(this.json);
        }
        catch (e) {
            this.error = true;
            this.forceUpdate();
        }
        if (!this.error) {
            typeof this.callback === 'function' && this.callback(this.json);
        }
    };
    return DialogStatemonitorEditJSON;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogStatemonitorEditJSON.prototype, "json", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogStatemonitorEditJSON.prototype, "callback", void 0);
DialogStatemonitorEditJSON = __decorate([
    core_1.Component({
        selector: 'dialog-statemonitor-editjson',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], DialogStatemonitorEditJSON);
exports.DialogStatemonitorEditJSON = DialogStatemonitorEditJSON;
//# sourceMappingURL=component.js.map
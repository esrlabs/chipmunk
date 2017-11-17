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
var DialogUpdate = (function () {
    function DialogUpdate() {
        this.info = null;
        this.progress = null;
        this.speed = null;
        this._version = '';
        this._progress = null;
        this._speed = null;
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.UPDATE_IS_AVAILABLE, this.UPDATE_IS_AVAILABLE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.UPDATE_DOWNLOAD_PROGRESS, this.UPDATE_DOWNLOAD_PROGRESS.bind(this));
    }
    DialogUpdate.prototype.UPDATE_IS_AVAILABLE = function (info) {
        this._version = info.info !== void 0 ? (info.info.version !== null ? info.info.version : null) : null;
    };
    DialogUpdate.prototype.UPDATE_DOWNLOAD_PROGRESS = function (state) {
        var speed = state.speed !== void 0 ? state.speed / 1024 : null;
        this._version = state.info !== void 0 ? (state.info.version !== null ? state.info.version : null) : null;
        this._progress = state.progress !== void 0 ? state.progress : null;
        this._speed = speed !== null ? speed.toFixed(2) : null;
    };
    return DialogUpdate;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogUpdate.prototype, "info", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogUpdate.prototype, "progress", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogUpdate.prototype, "speed", void 0);
DialogUpdate = __decorate([
    core_1.Component({
        selector: 'dialog-update',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DialogUpdate);
exports.DialogUpdate = DialogUpdate;
//# sourceMappingURL=component.js.map
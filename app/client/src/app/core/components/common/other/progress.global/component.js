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
var ProgressBarGlobal = (function () {
    function ProgressBarGlobal(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.visible = false;
        this.onGLOBAL_PROGRESS_SHOW = this.onGLOBAL_PROGRESS_SHOW.bind(this);
        this.onGLOBAL_PROGRESS_HIDE = this.onGLOBAL_PROGRESS_HIDE.bind(this);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW, this.onGLOBAL_PROGRESS_SHOW);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE, this.onGLOBAL_PROGRESS_HIDE);
    }
    ProgressBarGlobal.prototype.ngOnDestroy = function () {
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW, this.onGLOBAL_PROGRESS_SHOW);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE, this.onGLOBAL_PROGRESS_HIDE);
    };
    ProgressBarGlobal.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ProgressBarGlobal.prototype.onGLOBAL_PROGRESS_SHOW = function () {
        this.visible = true;
        this.forceUpdate();
    };
    ProgressBarGlobal.prototype.onGLOBAL_PROGRESS_HIDE = function () {
        this.visible = false;
        this.forceUpdate();
    };
    return ProgressBarGlobal;
}());
ProgressBarGlobal = __decorate([
    core_1.Component({
        selector: 'progress-bar-global',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ProgressBarGlobal);
exports.ProgressBarGlobal = ProgressBarGlobal;
//# sourceMappingURL=component.js.map
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
var controller_config_1 = require("../../../modules/controller.config");
var controller_events_1 = require("../../../modules/controller.events");
var EVENTS = {
    onFocus: 'onFocus',
    onBlur: 'onBlur',
    onKeyDown: 'onKeyDown',
    onKeyUp: 'onKeyUp',
    onChange: 'onChange'
};
var CommonInput = (function () {
    function CommonInput(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.value = '';
        this.type = 'text';
        this.placeholder = '';
        this.handles = {};
        this.onEnter = new core_1.EventEmitter();
    }
    CommonInput.prototype.getValue = function () {
        return this.input.element.nativeElement.value;
    };
    CommonInput.prototype.setValue = function (value) {
        //this.input.element.nativeElement.value  = value;
        //this.value                              = value;
        this.forceUpdate();
    };
    CommonInput.prototype.setFocus = function () {
        return this.input.element.nativeElement.focus();
    };
    CommonInput.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    CommonInput.prototype.handle = function (name, event) {
        typeof this.handles[name] === 'function' && this.handles[name](event);
    };
    CommonInput.prototype.onFocus = function (event) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
        this.handle(EVENTS.onFocus, event);
    };
    CommonInput.prototype.onBlur = function (event) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
        this.handle(EVENTS.onBlur, event);
    };
    CommonInput.prototype.onKeyDown = function (event) {
        this.handle(EVENTS.onKeyDown, event);
    };
    CommonInput.prototype.onKeyUp = function (event) {
        this.handle(EVENTS.onKeyUp, event);
        event.keyCode === 13 && this.onEnter.emit();
    };
    CommonInput.prototype.onChange = function (event) {
        this.handle(EVENTS.onChange, event);
    };
    return CommonInput;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], CommonInput.prototype, "value", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], CommonInput.prototype, "type", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], CommonInput.prototype, "placeholder", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], CommonInput.prototype, "handles", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", core_1.EventEmitter)
], CommonInput.prototype, "onEnter", void 0);
__decorate([
    core_1.ViewChild('input', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], CommonInput.prototype, "input", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommonInput.prototype, "getValue", null);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommonInput.prototype, "setValue", null);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommonInput.prototype, "setFocus", null);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommonInput.prototype, "forceUpdate", null);
CommonInput = __decorate([
    core_1.Component({
        selector: 'common-input',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], CommonInput);
exports.CommonInput = CommonInput;
//# sourceMappingURL=component.js.map
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
var SimpleCheckbox = (function () {
    function SimpleCheckbox(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.on = _('on');
        this.off = _('off');
        this.checked = false;
        this.onChange = null;
        this.changeDetectorRef = changeDetectorRef;
    }
    SimpleCheckbox.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    SimpleCheckbox.prototype.onChangeInput = function () {
        typeof this.onChange === 'function' && this.onChange(this.getValue(), this.setValue.bind(this));
    };
    SimpleCheckbox.prototype.getValue = function () {
        return this.input.element.nativeElement.checked;
    };
    SimpleCheckbox.prototype.setValue = function (value) {
        this.checked = value;
        this.input.element.nativeElement.checked = value;
        this.forceUpdate();
    };
    return SimpleCheckbox;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], SimpleCheckbox.prototype, "on", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], SimpleCheckbox.prototype, "off", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], SimpleCheckbox.prototype, "checked", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], SimpleCheckbox.prototype, "onChange", void 0);
__decorate([
    core_1.ViewChild('input', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], SimpleCheckbox.prototype, "input", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SimpleCheckbox.prototype, "getValue", null);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean]),
    __metadata("design:returntype", void 0)
], SimpleCheckbox.prototype, "setValue", null);
SimpleCheckbox = __decorate([
    core_1.Component({
        selector: 'simple-checkbox',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], SimpleCheckbox);
exports.SimpleCheckbox = SimpleCheckbox;
//# sourceMappingURL=component.js.map
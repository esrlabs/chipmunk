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
var SimpleDropDownList = (function () {
    function SimpleDropDownList(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.items = [];
        this.css = '';
        this.onChange = null;
        this.defaults = '';
    }
    SimpleDropDownList.prototype.ngAfterContentInit = function () {
        this.forceUpdate();
    };
    SimpleDropDownList.prototype.getValue = function () {
        return this.list.element.nativeElement.value;
    };
    SimpleDropDownList.prototype.setValue = function (value) {
        this.defaults = value;
        this.forceUpdate();
    };
    SimpleDropDownList.prototype.onChangeSelect = function (event) {
        this.defaults = event.target['value'];
        typeof this.onChange === 'function' && this.onChange(event.target['value']);
    };
    SimpleDropDownList.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    return SimpleDropDownList;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], SimpleDropDownList.prototype, "items", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], SimpleDropDownList.prototype, "css", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], SimpleDropDownList.prototype, "onChange", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], SimpleDropDownList.prototype, "defaults", void 0);
__decorate([
    core_1.ViewChild('list', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], SimpleDropDownList.prototype, "list", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SimpleDropDownList.prototype, "getValue", null);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SimpleDropDownList.prototype, "setValue", null);
SimpleDropDownList = __decorate([
    core_1.Component({
        selector: 'simple-dd-list',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], SimpleDropDownList);
exports.SimpleDropDownList = SimpleDropDownList;
//# sourceMappingURL=component.js.map
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
var ButtonFlatText = (function () {
    function ButtonFlatText() {
        this.caption = '';
        this.handle = function () { };
        this.enabled = true;
    }
    ButtonFlatText.prototype.disable = function () {
        return this.enabled = false;
    };
    ButtonFlatText.prototype.enable = function () {
        return this.enabled = true;
    };
    return ButtonFlatText;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ButtonFlatText.prototype, "caption", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ButtonFlatText.prototype, "handle", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ButtonFlatText.prototype, "enabled", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ButtonFlatText.prototype, "disable", null);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ButtonFlatText.prototype, "enable", null);
ButtonFlatText = __decorate([
    core_1.Component({
        selector: 'button-flat-text',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], ButtonFlatText);
exports.ButtonFlatText = ButtonFlatText;
//# sourceMappingURL=component.js.map
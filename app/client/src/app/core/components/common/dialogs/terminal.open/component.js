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
var component_1 = require("../../input/component");
var DialogTerminalStreamOpen = (function () {
    function DialogTerminalStreamOpen() {
        this.alias = '';
        this.path = '';
        this.keywords = '';
        this.proceed = null;
        this.cancel = null;
        this.onProceed = this.onProceed.bind(this);
    }
    DialogTerminalStreamOpen.prototype.onProceed = function () {
        this.proceed({
            alias: this._alias.getValue(),
            keywords: this._keywords.getValue(),
            path: this._path.getValue()
        });
    };
    return DialogTerminalStreamOpen;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogTerminalStreamOpen.prototype, "alias", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogTerminalStreamOpen.prototype, "path", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogTerminalStreamOpen.prototype, "keywords", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogTerminalStreamOpen.prototype, "proceed", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogTerminalStreamOpen.prototype, "cancel", void 0);
__decorate([
    core_1.ViewChild('_alias'),
    __metadata("design:type", component_1.CommonInput)
], DialogTerminalStreamOpen.prototype, "_alias", void 0);
__decorate([
    core_1.ViewChild('_keywords'),
    __metadata("design:type", component_1.CommonInput)
], DialogTerminalStreamOpen.prototype, "_keywords", void 0);
__decorate([
    core_1.ViewChild('_path'),
    __metadata("design:type", component_1.CommonInput)
], DialogTerminalStreamOpen.prototype, "_path", void 0);
DialogTerminalStreamOpen = __decorate([
    core_1.Component({
        selector: 'dialog-terminalstream-settings',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DialogTerminalStreamOpen);
exports.DialogTerminalStreamOpen = DialogTerminalStreamOpen;
//# sourceMappingURL=component.js.map
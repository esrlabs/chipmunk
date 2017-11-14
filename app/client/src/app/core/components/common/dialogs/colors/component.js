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
var ColorsDialog = (function () {
    function ColorsDialog() {
        this.callback = null;
        this.colors = [];
    }
    ColorsDialog.prototype.onClick = function (event) {
        typeof this.callback === 'function' && this.callback(event.target['style'].backgroundColor);
    };
    return ColorsDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ColorsDialog.prototype, "callback", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ColorsDialog.prototype, "colors", void 0);
ColorsDialog = __decorate([
    core_1.Component({
        selector: 'colors-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], ColorsDialog);
exports.ColorsDialog = ColorsDialog;
//# sourceMappingURL=component.js.map
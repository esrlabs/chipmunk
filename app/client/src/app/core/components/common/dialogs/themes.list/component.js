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
var DialogThemesList = (function () {
    function DialogThemesList() {
        this.themes = [];
        this.handler = null;
    }
    DialogThemesList.prototype.onSelect = function (file) {
        typeof this.handler === 'function' && this.handler(file);
    };
    return DialogThemesList;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], DialogThemesList.prototype, "themes", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogThemesList.prototype, "handler", void 0);
DialogThemesList = __decorate([
    core_1.Component({
        selector: 'dialog-themes-list',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DialogThemesList);
exports.DialogThemesList = DialogThemesList;
//# sourceMappingURL=component.js.map
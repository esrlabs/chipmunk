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
var DropDownMenu = (function () {
    function DropDownMenu() {
        this.className = '';
        this.icon = '';
        this.caption = '';
        this.items = [];
    }
    return DropDownMenu;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DropDownMenu.prototype, "className", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DropDownMenu.prototype, "icon", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DropDownMenu.prototype, "caption", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], DropDownMenu.prototype, "items", void 0);
DropDownMenu = __decorate([
    core_1.Component({
        selector: 'drop-down-menu',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DropDownMenu);
exports.DropDownMenu = DropDownMenu;
//# sourceMappingURL=component.js.map
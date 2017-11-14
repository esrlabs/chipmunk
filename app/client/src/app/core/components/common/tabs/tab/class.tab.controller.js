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
var class_view_1 = require("../../../../services/class.view");
var TabController = (function () {
    function TabController() {
        this.viewParams = null;
        this.onSelect = null;
        this.onDeselect = null;
        this.onResize = null;
    }
    return TabController;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", class_view_1.ViewClass)
], TabController.prototype, "viewParams", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], TabController.prototype, "onSelect", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], TabController.prototype, "onDeselect", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], TabController.prototype, "onResize", void 0);
exports.TabController = TabController;
//# sourceMappingURL=class.tab.controller.js.map
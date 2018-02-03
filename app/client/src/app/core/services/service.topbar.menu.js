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
var controller_config_1 = require("../modules/controller.config");
var MODES = {
    web: 'web',
    desktop: 'desktop'
};
var ServiceTopBarMenuItems = (function () {
    function ServiceTopBarMenuItems() {
        this.mode = MODES.web;
        this.menu = [];
        this.menu = controller_config_1.configuration.sets.MENU.web.map(function (item) {
            return Object.assign({}, item);
        });
    }
    ServiceTopBarMenuItems.prototype.getItems = function () {
        switch (this.mode) {
            case MODES.web:
                return this.menu;
            default:
                return [];
        }
    };
    return ServiceTopBarMenuItems;
}());
ServiceTopBarMenuItems = __decorate([
    core_1.Injectable(),
    __metadata("design:paramtypes", [])
], ServiceTopBarMenuItems);
exports.ServiceTopBarMenuItems = ServiceTopBarMenuItems;
//# sourceMappingURL=service.topbar.menu.js.map
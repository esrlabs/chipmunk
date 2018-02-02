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
var controller_events_1 = require("../../../../core/modules/controller.events");
var controller_config_1 = require("../../../../core/modules/controller.config");
var TopBar = (function () {
    function TopBar() {
        this.desktop = false;
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESKTOP_MODE_NOTIFICATION, this.onDESKTOP_MODE_NOTIFICATION.bind(this));
    }
    TopBar.prototype.ngOnDestroy = function () {
    };
    TopBar.prototype.onDESKTOP_MODE_NOTIFICATION = function () {
        this.desktop = true;
    };
    return TopBar;
}());
TopBar = __decorate([
    core_1.Component({
        selector: 'top-bar',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], TopBar);
exports.TopBar = TopBar;
//# sourceMappingURL=component.js.map
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
var controller_config_1 = require("../../../../modules/controller.config");
var controller_events_1 = require("../../../../modules/controller.events");
var ViewsList = (function () {
    function ViewsList() {
        this.popupGUID = '';
        this.views = [];
        this.generateViews();
    }
    ViewsList.prototype.generateViews = function () {
        var _this = this;
        this.views = Object.keys(controller_config_1.configuration.sets.VIEWS).map(function (view_id) {
            return {
                name: controller_config_1.configuration.sets.VIEWS[view_id].name,
                description: controller_config_1.configuration.sets.VIEWS[view_id].description,
                icon: controller_config_1.configuration.sets.VIEWS[view_id].icon,
                handle: _this.addView.bind(_this, view_id)
            };
        });
    };
    ViewsList.prototype.addView = function (view_id) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADD_VIEW, view_id);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.popupGUID);
    };
    return ViewsList;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewsList.prototype, "popupGUID", void 0);
ViewsList = __decorate([
    core_1.Component({
        selector: 'views-list',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], ViewsList);
exports.ViewsList = ViewsList;
//# sourceMappingURL=component.js.map
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
var service_topbar_buttons_static_1 = require("./service.topbar.buttons.static");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var ServiceTopBarButtons = (function () {
    function ServiceTopBarButtons() {
        this.storage = service_topbar_buttons_static_1.staticTopBarButtonsStorage;
        this.addButton = this.addButton.bind(this);
        this.removeButton = this.removeButton.bind(this);
        this.updateButton = this.updateButton.bind(this);
        controller_events_1.events.bind(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, this.addButton);
        controller_events_1.events.bind(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.removeButton);
        controller_events_1.events.bind(controller_config_1.configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, this.updateButton);
    }
    ServiceTopBarButtons.prototype.ngOnDestroy = function () {
        controller_events_1.events.unbind(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, this.addButton);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.removeButton);
        controller_events_1.events.unbind(controller_config_1.configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, this.updateButton);
    };
    ServiceTopBarButtons.prototype.getItems = function () {
        return Promise.resolve(this.storage.getItems());
    };
    ServiceTopBarButtons.prototype.addButton = function (button) {
        this.storage.addButton(button);
    };
    ServiceTopBarButtons.prototype.removeButton = function (id) {
        this.storage.removeButton(id);
    };
    ServiceTopBarButtons.prototype.updateButton = function (button) {
        this.storage.updateButton(button);
    };
    return ServiceTopBarButtons;
}());
ServiceTopBarButtons = __decorate([
    core_1.Injectable(),
    __metadata("design:paramtypes", [])
], ServiceTopBarButtons);
exports.ServiceTopBarButtons = ServiceTopBarButtons;
//# sourceMappingURL=service.topbar.buttons.js.map
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
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var service_topbar_buttons_1 = require("../../../services/service.topbar.buttons");
var TopBarSpaceHolder = (function () {
    function TopBarSpaceHolder(changeDetectorRef, serviceTopBarButtons) {
        this.changeDetectorRef = changeDetectorRef;
        this.serviceTopBarButtons = serviceTopBarButtons;
        this.shortcuts = [];
        this.description = 'Welcome to LogViewer';
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, this.onDESCRIPTION_OF_STREAM_UPDATED.bind(this));
    }
    TopBarSpaceHolder.prototype.getButtons = function () {
        var _this = this;
        this.serviceTopBarButtons.getItems().then(function (items) {
            _this.shortcuts = items;
        });
    };
    TopBarSpaceHolder.prototype.ngOnInit = function () {
        this.getButtons();
    };
    TopBarSpaceHolder.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    TopBarSpaceHolder.prototype.onDESCRIPTION_OF_STREAM_UPDATED = function (description) {
        this.description = description;
        this.forceUpdate();
    };
    return TopBarSpaceHolder;
}());
TopBarSpaceHolder = __decorate([
    core_1.Component({
        selector: 'topbar-space-holder',
        templateUrl: './template.html',
        providers: [service_topbar_buttons_1.ServiceTopBarButtons]
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef,
        service_topbar_buttons_1.ServiceTopBarButtons])
], TopBarSpaceHolder);
exports.TopBarSpaceHolder = TopBarSpaceHolder;
//# sourceMappingURL=component.js.map
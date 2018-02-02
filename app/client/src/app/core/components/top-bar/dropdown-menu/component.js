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
var service_topbar_menu_1 = require("../../../services/service.topbar.menu");
var topbar_menu_hadles_1 = require("../../../handles/topbar.menu.hadles");
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
;
var TopBarDropDownMenu = (function () {
    function TopBarDropDownMenu(serviceTopBarMenuItems, changeDetectorRef) {
        this.serviceTopBarMenuItems = serviceTopBarMenuItems;
        this.changeDetectorRef = changeDetectorRef;
        this.className = 'top-bar-correction';
        this.icon = 'fa-navicon';
        this.caption = null;
        this.items = [];
        this.visible = true;
        this.items = serviceTopBarMenuItems.getItems();
        this.handles();
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.MENU_HANDLER_CALL, this.onMENU_HANDLER_CALL.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESKTOP_MODE_NOTIFICATION, this.onDESKTOP_MODE_NOTIFICATION.bind(this));
    }
    TopBarDropDownMenu.prototype.handles = function () {
        this.items = this.items.map(function (item) {
            if (typeof item.handler === 'string' && topbar_menu_hadles_1.topbarMenuHandles[item.handler] !== void 0) {
                item.handler = topbar_menu_hadles_1.topbarMenuHandles[item.handler];
            }
            else {
                item.handler = function () { };
            }
            return item;
        });
    };
    TopBarDropDownMenu.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    TopBarDropDownMenu.prototype.onMENU_HANDLER_CALL = function (params) {
        topbar_menu_hadles_1.topbarMenuHandles[params.handler] !== void 0 && topbar_menu_hadles_1.topbarMenuHandles[params.handler]();
    };
    TopBarDropDownMenu.prototype.onDESKTOP_MODE_NOTIFICATION = function () {
        this.visible = false;
        this.forceUpdate();
    };
    return TopBarDropDownMenu;
}());
TopBarDropDownMenu = __decorate([
    core_1.Component({
        selector: 'top-bar-drop-down-menu',
        templateUrl: './template.html',
        providers: [service_topbar_menu_1.ServiceTopBarMenuItems]
    }),
    __metadata("design:paramtypes", [service_topbar_menu_1.ServiceTopBarMenuItems, core_1.ChangeDetectorRef])
], TopBarDropDownMenu);
exports.TopBarDropDownMenu = TopBarDropDownMenu;
//# sourceMappingURL=component.js.map
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
var TopBarDropDownMenu = (function () {
    function TopBarDropDownMenu(serviceTopBarMenuItems) {
        this.serviceTopBarMenuItems = serviceTopBarMenuItems;
        this.className = 'top-bar-correction';
        this.icon = 'fa-navicon';
        this.caption = null;
        this.items = [];
        this.items = serviceTopBarMenuItems.getItems();
        this.handles();
    }
    TopBarDropDownMenu.prototype.handles = function () {
        this.items = this.items.map(function (item) {
            if (typeof item.handle === 'string' && topbar_menu_hadles_1.topbarMenuHandles[item.handle] !== void 0) {
                item.handle = topbar_menu_hadles_1.topbarMenuHandles[item.handle];
            }
            else {
                item.handle = function () { };
            }
            return item;
        });
    };
    return TopBarDropDownMenu;
}());
TopBarDropDownMenu = __decorate([
    core_1.Component({
        selector: 'top-bar-drop-down-menu',
        templateUrl: './template.html',
        providers: [service_topbar_menu_1.ServiceTopBarMenuItems]
    }),
    __metadata("design:paramtypes", [service_topbar_menu_1.ServiceTopBarMenuItems])
], TopBarDropDownMenu);
exports.TopBarDropDownMenu = TopBarDropDownMenu;
//# sourceMappingURL=component.js.map
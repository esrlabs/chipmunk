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
var common_1 = require("@angular/common");
var component_1 = require("../../components/top-bar/layout/component");
var component_2 = require("../../components/top-bar/search.request/component");
var component_3 = require("../../components/top-bar/space.holder/component");
var component_4 = require("../../components/top-bar/dropdown-menu/component");
var components_1 = require("../../components/common/components");
var TopBarModule = (function () {
    function TopBarModule() {
    }
    return TopBarModule;
}());
TopBarModule = __decorate([
    core_1.NgModule({
        imports: [common_1.CommonModule, components_1.Components],
        declarations: [component_1.TopBar, component_2.TopBarSearchRequest, component_3.TopBarSpaceHolder, component_4.TopBarDropDownMenu],
        exports: [component_1.TopBar, component_2.TopBarSearchRequest, component_3.TopBarSpaceHolder, component_4.TopBarDropDownMenu]
    }),
    __metadata("design:paramtypes", [])
], TopBarModule);
exports.TopBarModule = TopBarModule;
//# sourceMappingURL=module.js.map
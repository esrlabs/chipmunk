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
var platform_browser_1 = require("@angular/platform-browser");
var component_1 = require("./core/grid/layout/component");
var component_2 = require("./core/grid/root-holder/component");
var module_1 = require("./core/grid/holder/module");
var module_2 = require("./core/grid/top-bar/module");
var components_1 = require("./core/components/common/components");
var ws_connector_1 = require("./core/ws/ws.connector");
var api_processor_1 = require("./core/api/api.processor");
var service_serialports_1 = require("./core/services/service.serialports");
var controller_themes_1 = require("./core/modules/controller.themes");
var controller_shortcut_1 = require("./core/modules/controller.shortcut");
var controller_updater_1 = require("./core/modules/controller.updater");
var AppModule = (function () {
    function AppModule() {
        this.wsConnector = null;
        this.shortcutController = new controller_shortcut_1.ShortcutController();
        this.serialPorts = new service_serialports_1.SerialPorts();
        this.updater = new controller_updater_1.Updater();
        api_processor_1.APIProcessor.init();
        controller_themes_1.controllerThemes.init();
        this.wsConnector = new ws_connector_1.WebSocketConnector();
        this.wsConnector.connect();
    }
    return AppModule;
}());
AppModule = __decorate([
    core_1.NgModule({
        imports: [platform_browser_1.BrowserModule, components_1.Components, module_2.TopBarModule, module_1.HolderModule],
        declarations: [component_1.Layout, component_2.RootHolder],
        bootstrap: [component_1.Layout]
    }),
    __metadata("design:paramtypes", [])
], AppModule);
exports.AppModule = AppModule;
//# sourceMappingURL=app.module.js.map
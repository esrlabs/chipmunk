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
var component_1 = require("../../components/holder/layout/component");
var component_2 = require("../../components/holder/view/component");
var component_3 = require("../../components/holder/view-bar/component");
var components_1 = require("../../components/common/components");
var controllers_1 = require("../../../views/controllers");
var module_1 = require("../../../views/list/module");
var module_2 = require("../../../views/search.results/module");
var module_3 = require("../../../views/chart/module");
var module_4 = require("../../../views/statemonitor/module");
var module_5 = require("../../../views/streamsender/module");
var module_6 = require("../../../views/markers/module");
var module_7 = require("../../components/common/dialogs/monitor.manager/module");
var HolderModule = (function () {
    function HolderModule() {
    }
    return HolderModule;
}());
HolderModule = __decorate([
    core_1.NgModule({
        entryComponents: [],
        imports: [common_1.CommonModule, components_1.Components],
        declarations: [component_1.Holder, component_2.View, component_3.ViewBar, controllers_1.DynamicComponent],
        exports: [component_1.Holder, component_2.View, component_3.ViewBar, module_1.ViewListModule, module_2.ViewSearchResultsModule, module_3.ViewChartModule, module_4.ViewStateMonitorModule, module_5.ViewStreamSenderModule, module_6.ViewMarkersModule, module_7.DialogMonitorManagerModule]
    }),
    __metadata("design:paramtypes", [])
], HolderModule);
exports.HolderModule = HolderModule;
//# sourceMappingURL=module.js.map
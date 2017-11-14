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
var forms_1 = require("@angular/forms");
var common_1 = require("@angular/common");
var component_1 = require("./component");
var components_1 = require("../../core/components/common/components");
var component_2 = require("./history.item/component");
var ViewStreamSenderModule = (function () {
    function ViewStreamSenderModule() {
    }
    return ViewStreamSenderModule;
}());
ViewStreamSenderModule = __decorate([
    core_1.NgModule({
        entryComponents: [component_2.StreamSenderHistoryItem],
        imports: [platform_browser_1.BrowserModule, forms_1.FormsModule, common_1.CommonModule, components_1.Components],
        declarations: [component_1.ViewControllerStreamSender, component_2.StreamSenderHistoryItem],
        exports: [component_1.ViewControllerStreamSender, component_2.StreamSenderHistoryItem]
    }),
    __metadata("design:paramtypes", [])
], ViewStreamSenderModule);
exports.ViewStreamSenderModule = ViewStreamSenderModule;
//# sourceMappingURL=module.js.map
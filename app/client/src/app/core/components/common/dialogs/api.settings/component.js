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
var component_1 = require("../../input/component");
var interface_configuration_sets_system_1 = require("../../../../interfaces/interface.configuration.sets.system");
var DialogAPISettings = (function () {
    function DialogAPISettings() {
        this.serverAPI = '';
        this.serverWS = '';
        this.serverWSProtocol = '';
        this.serverWSTimeout = '';
        this.proceed = null;
        this.cancel = null;
        this.onProceed = this.onProceed.bind(this);
    }
    DialogAPISettings.prototype.onProceed = function () {
        typeof this.proceed === 'function' && this.proceed((_a = {},
            _a[interface_configuration_sets_system_1.SET_KEYS.API_URL] = this._serverAPI.getValue(),
            _a[interface_configuration_sets_system_1.SET_KEYS.WS_URL] = this._serverWS.getValue(),
            _a[interface_configuration_sets_system_1.SET_KEYS.WS_PROTOCOL] = this._serverWSProtocol.getValue(),
            _a[interface_configuration_sets_system_1.SET_KEYS.WS_RECONNECTION_TIMEOUT] = this._serverWSTimeout.getValue(),
            _a));
        var _a;
    };
    return DialogAPISettings;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogAPISettings.prototype, "serverAPI", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogAPISettings.prototype, "serverWS", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogAPISettings.prototype, "serverWSProtocol", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogAPISettings.prototype, "serverWSTimeout", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogAPISettings.prototype, "proceed", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogAPISettings.prototype, "cancel", void 0);
__decorate([
    core_1.ViewChild('_serverAPI'),
    __metadata("design:type", component_1.CommonInput)
], DialogAPISettings.prototype, "_serverAPI", void 0);
__decorate([
    core_1.ViewChild('_serverWS'),
    __metadata("design:type", component_1.CommonInput)
], DialogAPISettings.prototype, "_serverWS", void 0);
__decorate([
    core_1.ViewChild('_serverWSProtocol'),
    __metadata("design:type", component_1.CommonInput)
], DialogAPISettings.prototype, "_serverWSProtocol", void 0);
__decorate([
    core_1.ViewChild('_serverWSTimeout'),
    __metadata("design:type", component_1.CommonInput)
], DialogAPISettings.prototype, "_serverWSTimeout", void 0);
DialogAPISettings = __decorate([
    core_1.Component({
        selector: 'dialog-api-settings',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DialogAPISettings);
exports.DialogAPISettings = DialogAPISettings;
//# sourceMappingURL=component.js.map
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
var component_1 = require("../../checkboxes/simple/component");
var component_2 = require("../../input/component");
var defaults_settings_1 = require("./defaults.settings");
var defaults = new defaults_settings_1.DefaultsPortSettings();
var STRICTLY_DEFAULTS = {
    lock: false
};
var DialogSerialSettings = (function () {
    function DialogSerialSettings() {
        this.lock = defaults.lock;
        this.baudRate = defaults.baudRate;
        this.dataBits = defaults.dataBits;
        this.stopBits = defaults.stopBits;
        this.rtscts = defaults.rtscts;
        this.xon = defaults.xon;
        this.xoff = defaults.xoff;
        this.xany = defaults.xany;
        this.bufferSize = defaults.bufferSize;
        this.vmin = defaults.vmin;
        this.vtime = defaults.vtime;
        this.vtransmit = defaults.vtransmit;
        this.proceed = null;
        this.cancel = null;
        this.onProceed = this.onProceed.bind(this);
    }
    DialogSerialSettings.prototype.onProceed = function () {
        this.proceed({
            lock: STRICTLY_DEFAULTS.lock,
            baudRate: parseInt(this._baudRate.getValue(), 10),
            dataBits: parseInt(this._dataBits.getValue(), 10),
            stopBits: parseInt(this._stopBits.getValue(), 10),
            rtscts: this._rtscts.getValue(),
            xon: this._xon.getValue(),
            xoff: this._xoff.getValue(),
            xany: this._xany.getValue(),
            bufferSize: parseInt(this._bufferSize.getValue(), 10),
            vmin: parseInt(this._vmin.getValue(), 10),
            vtime: parseInt(this._vtime.getValue(), 10),
            vtransmit: parseInt(this._vtransmit.getValue(), 10)
        });
    };
    return DialogSerialSettings;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogSerialSettings.prototype, "lock", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "baudRate", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "dataBits", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "stopBits", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogSerialSettings.prototype, "rtscts", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogSerialSettings.prototype, "xon", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogSerialSettings.prototype, "xoff", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogSerialSettings.prototype, "xany", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "bufferSize", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "vmin", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "vtime", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogSerialSettings.prototype, "vtransmit", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogSerialSettings.prototype, "proceed", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogSerialSettings.prototype, "cancel", void 0);
__decorate([
    core_1.ViewChild('_baudRate'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_baudRate", void 0);
__decorate([
    core_1.ViewChild('_dataBits'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_dataBits", void 0);
__decorate([
    core_1.ViewChild('_stopBits'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_stopBits", void 0);
__decorate([
    core_1.ViewChild('_rtscts'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogSerialSettings.prototype, "_rtscts", void 0);
__decorate([
    core_1.ViewChild('_xon'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogSerialSettings.prototype, "_xon", void 0);
__decorate([
    core_1.ViewChild('_xoff'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogSerialSettings.prototype, "_xoff", void 0);
__decorate([
    core_1.ViewChild('_xany'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogSerialSettings.prototype, "_xany", void 0);
__decorate([
    core_1.ViewChild('_bufferSize'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_bufferSize", void 0);
__decorate([
    core_1.ViewChild('_vmin'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_vmin", void 0);
__decorate([
    core_1.ViewChild('_vtime'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_vtime", void 0);
__decorate([
    core_1.ViewChild('_vtransmit'),
    __metadata("design:type", component_2.CommonInput)
], DialogSerialSettings.prototype, "_vtransmit", void 0);
DialogSerialSettings = __decorate([
    core_1.Component({
        selector: 'dialog-serial-settings',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DialogSerialSettings);
exports.DialogSerialSettings = DialogSerialSettings;
//# sourceMappingURL=component.js.map
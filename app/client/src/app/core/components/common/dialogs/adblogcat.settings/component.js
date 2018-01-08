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
var DialogADBLogcatStreamSettings = (function () {
    function DialogADBLogcatStreamSettings() {
        this.V = true;
        this.I = true;
        this.D = true;
        this.W = true;
        this.E = true;
        this.S = true;
        this.F = true;
        this.tid = -1;
        this.pid = -1;
        this.path = '';
        this.reset = false;
        this.proceed = null;
        this.cancel = null;
        this.onProceed = this.onProceed.bind(this);
    }
    DialogADBLogcatStreamSettings.prototype.onProceed = function () {
        var _this = this;
        var levels = {};
        ['V', 'I', 'E', 'D', 'F', 'S', 'W'].forEach(function (key) {
            levels[key] = _this['_level_' + key].getValue();
        });
        this.proceed({
            levels: levels,
            tid: parseInt(this._tid.getValue(), 10),
            pid: parseInt(this._pid.getValue(), 10),
            path: this._path.getValue(),
            reset: this._reset.getValue()
        });
    };
    return DialogADBLogcatStreamSettings;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "V", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "I", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "D", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "W", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "E", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "S", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "F", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogADBLogcatStreamSettings.prototype, "tid", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogADBLogcatStreamSettings.prototype, "pid", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogADBLogcatStreamSettings.prototype, "path", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], DialogADBLogcatStreamSettings.prototype, "reset", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogADBLogcatStreamSettings.prototype, "proceed", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogADBLogcatStreamSettings.prototype, "cancel", void 0);
__decorate([
    core_1.ViewChild('_level_V'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_V", void 0);
__decorate([
    core_1.ViewChild('_level_I'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_I", void 0);
__decorate([
    core_1.ViewChild('_level_D'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_D", void 0);
__decorate([
    core_1.ViewChild('_level_W'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_W", void 0);
__decorate([
    core_1.ViewChild('_level_E'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_E", void 0);
__decorate([
    core_1.ViewChild('_level_S'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_S", void 0);
__decorate([
    core_1.ViewChild('_level_F'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_level_F", void 0);
__decorate([
    core_1.ViewChild('_tid'),
    __metadata("design:type", component_2.CommonInput)
], DialogADBLogcatStreamSettings.prototype, "_tid", void 0);
__decorate([
    core_1.ViewChild('_pid'),
    __metadata("design:type", component_2.CommonInput)
], DialogADBLogcatStreamSettings.prototype, "_pid", void 0);
__decorate([
    core_1.ViewChild('_path'),
    __metadata("design:type", component_2.CommonInput)
], DialogADBLogcatStreamSettings.prototype, "_path", void 0);
__decorate([
    core_1.ViewChild('_reset'),
    __metadata("design:type", component_1.SimpleCheckbox)
], DialogADBLogcatStreamSettings.prototype, "_reset", void 0);
DialogADBLogcatStreamSettings = __decorate([
    core_1.Component({
        selector: 'dialog-adblogcatstream-settings',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], DialogADBLogcatStreamSettings);
exports.DialogADBLogcatStreamSettings = DialogADBLogcatStreamSettings;
//# sourceMappingURL=component.js.map
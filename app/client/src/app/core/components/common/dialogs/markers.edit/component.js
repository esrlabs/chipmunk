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
var MarkersEditDialog = (function () {
    function MarkersEditDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.callback = null;
        this.colors = [];
        this.hook = '';
        this.foregroundColor = 'rgb(50,250,50)';
        this.backgroundColor = 'rgb(250,250,250)';
        this.changeDetectorRef = changeDetectorRef;
        this.onForegroundColorSelected = this.onForegroundColorSelected.bind(this);
        this.onBackgroundColorSelected = this.onBackgroundColorSelected.bind(this);
        this.onApply = this.onApply.bind(this);
    }
    MarkersEditDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    MarkersEditDialog.prototype.onForegroundColorSelected = function (color) {
        this.foregroundColor = color;
        this.forceUpdate();
    };
    MarkersEditDialog.prototype.onBackgroundColorSelected = function (color) {
        this.backgroundColor = color;
        this.forceUpdate();
    };
    MarkersEditDialog.prototype.onApply = function () {
        this.hook = this._hook.getValue();
        if (this.hook.trim() !== '') {
            typeof this.callback === 'function' && this.callback({
                hook: this.hook,
                backgroundColor: this.backgroundColor,
                foregroundColor: this.foregroundColor
            });
        }
    };
    return MarkersEditDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], MarkersEditDialog.prototype, "callback", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], MarkersEditDialog.prototype, "colors", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], MarkersEditDialog.prototype, "hook", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], MarkersEditDialog.prototype, "foregroundColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], MarkersEditDialog.prototype, "backgroundColor", void 0);
__decorate([
    core_1.ViewChild('_hook'),
    __metadata("design:type", component_1.CommonInput)
], MarkersEditDialog.prototype, "_hook", void 0);
MarkersEditDialog = __decorate([
    core_1.Component({
        selector: 'markers-edit-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], MarkersEditDialog);
exports.MarkersEditDialog = MarkersEditDialog;
//# sourceMappingURL=component.js.map
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
var ChartEditColorDialog = (function () {
    function ChartEditColorDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.callback = null;
        this.colors = [];
        this.hook = '';
        this.foregroundColor = 'rgb(50,250,50)';
        this.backgroundColor = 'rgb(250,250,250)';
        this.changeDetectorRef = changeDetectorRef;
        this.onForegroundColorSelected = this.onForegroundColorSelected.bind(this);
        this.onBackgroundColorSelected = this.onBackgroundColorSelected.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onApply = this.onApply.bind(this);
    }
    ChartEditColorDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ChartEditColorDialog.prototype.onForegroundColorSelected = function (color) {
        this.foregroundColor = color;
        this.forceUpdate();
    };
    ChartEditColorDialog.prototype.onBackgroundColorSelected = function (color) {
        this.backgroundColor = color;
        this.forceUpdate();
    };
    ChartEditColorDialog.prototype.onKeyUp = function (event) {
        this.hook = event.target['value'];
    };
    ChartEditColorDialog.prototype.onApply = function () {
        if (this.hook.trim() !== '') {
            typeof this.callback === 'function' && this.callback({
                hook: this.hook,
                backgroundColor: this.backgroundColor,
                foregroundColor: this.foregroundColor
            });
        }
    };
    return ChartEditColorDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ChartEditColorDialog.prototype, "callback", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ChartEditColorDialog.prototype, "colors", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ChartEditColorDialog.prototype, "hook", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ChartEditColorDialog.prototype, "foregroundColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ChartEditColorDialog.prototype, "backgroundColor", void 0);
ChartEditColorDialog = __decorate([
    core_1.Component({
        selector: 'chart-edit-color-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ChartEditColorDialog);
exports.ChartEditColorDialog = ChartEditColorDialog;
//# sourceMappingURL=component.js.map
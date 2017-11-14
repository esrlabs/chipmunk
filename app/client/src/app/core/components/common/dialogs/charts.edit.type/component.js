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
var component_1 = require("../image/component");
var controller_1 = require("../../../common/popup/controller");
var ChartEditTypeDialog = (function () {
    function ChartEditTypeDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.onSelect = null;
        this.types = [];
        this.changeDetectorRef = changeDetectorRef;
    }
    ChartEditTypeDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ChartEditTypeDialog.prototype.onMoreInfo = function (url) {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ImageDialog,
                params: {
                    url: url
                }
            },
            title: _('Scheme of type'),
            settings: {
                move: true,
                resize: true,
                width: '95%',
                height: '95%',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ChartEditTypeDialog.prototype.onSelectType = function (id) {
        typeof this.onSelect === 'function' && this.onSelect(id);
    };
    return ChartEditTypeDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ChartEditTypeDialog.prototype, "onSelect", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ChartEditTypeDialog.prototype, "types", void 0);
ChartEditTypeDialog = __decorate([
    core_1.Component({
        selector: 'chart-edit-type-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ChartEditTypeDialog);
exports.ChartEditTypeDialog = ChartEditTypeDialog;
//# sourceMappingURL=component.js.map
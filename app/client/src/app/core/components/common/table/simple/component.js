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
var CommonSimpleTable = (function () {
    function CommonSimpleTable(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.rows = [];
        this.columns = [];
        this.cssClasses = {
            column: '',
            row: ''
        };
        this.onSelect = new core_1.EventEmitter();
        this.selected = -1;
    }
    CommonSimpleTable.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    CommonSimpleTable.prototype.onSelectRow = function (index) {
        this.selected = this.selected === index ? -1 : index;
        this.onSelect.emit(this.selected);
    };
    return CommonSimpleTable;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], CommonSimpleTable.prototype, "rows", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], CommonSimpleTable.prototype, "columns", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], CommonSimpleTable.prototype, "cssClasses", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", core_1.EventEmitter)
], CommonSimpleTable.prototype, "onSelect", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CommonSimpleTable.prototype, "forceUpdate", null);
CommonSimpleTable = __decorate([
    core_1.Component({
        selector: 'common-simple-table',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], CommonSimpleTable);
exports.CommonSimpleTable = CommonSimpleTable;
//# sourceMappingURL=component.js.map
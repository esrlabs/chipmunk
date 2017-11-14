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
var DialogStatemonitorIndicateEdit = (function () {
    function DialogStatemonitorIndicateEdit(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.name = '';
        this.callback = null;
        this.onSave = this.onSave.bind(this);
        this.onLabelChange = this.onLabelChange.bind(this);
    }
    DialogStatemonitorIndicateEdit.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    DialogStatemonitorIndicateEdit.prototype.onLabelChange = function (event) {
        this.name = event.target['value'];
        this.forceUpdate();
    };
    DialogStatemonitorIndicateEdit.prototype.onSave = function () {
        typeof this.callback === 'function' && this.callback(this.name);
    };
    return DialogStatemonitorIndicateEdit;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogStatemonitorIndicateEdit.prototype, "name", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogStatemonitorIndicateEdit.prototype, "callback", void 0);
DialogStatemonitorIndicateEdit = __decorate([
    core_1.Component({
        selector: 'dialog-statemonitor-indicate-edit',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], DialogStatemonitorIndicateEdit);
exports.DialogStatemonitorIndicateEdit = DialogStatemonitorIndicateEdit;
//# sourceMappingURL=component.js.map
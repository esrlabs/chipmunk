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
var ImageDialog = (function () {
    function ImageDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.url = '';
        this.changeDetectorRef = changeDetectorRef;
    }
    ImageDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    return ImageDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ImageDialog.prototype, "url", void 0);
ImageDialog = __decorate([
    core_1.Component({
        selector: 'image-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ImageDialog);
exports.ImageDialog = ImageDialog;
//# sourceMappingURL=component.js.map
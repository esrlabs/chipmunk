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
var LongListItem = (function () {
    function LongListItem(container, changeDetectorRef) {
        this.container = container;
        this.changeDetectorRef = changeDetectorRef;
    }
    LongListItem.prototype.update = function (params) {
        var _this = this;
        Object.keys(params).forEach(function (key) {
            _this.ref.instance[key] = params[key];
        });
        this.changeDetectorRef.detectChanges();
    };
    LongListItem.prototype.ngOnInit = function () {
        var _this = this;
        this.ref = this.container.createComponent(this.component.factory);
        if (this.component.params !== void 0) {
            Object.keys(this.component.params).forEach(function (key) {
                _this.ref.instance[key] = _this.component.params[key];
            });
        }
        typeof this.component.callback === 'function' && this.component.callback(this.ref.instance);
        this.component.forceUpdate = this.update.bind(this);
    };
    LongListItem.prototype.ngOnDestroy = function () {
        this.ref.destroy();
    };
    return LongListItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], LongListItem.prototype, "component", void 0);
LongListItem = __decorate([
    core_1.Component({
        selector: 'long-list-item',
        template: '',
    }),
    __metadata("design:paramtypes", [core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], LongListItem);
exports.LongListItem = LongListItem;
//# sourceMappingURL=component.js.map
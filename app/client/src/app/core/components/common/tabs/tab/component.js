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
var TabItem = (function () {
    function TabItem(container, changeDetectorRef) {
        this.container = container;
        this.changeDetectorRef = changeDetectorRef;
    }
    TabItem.prototype.update = function (params) {
        var _this = this;
        Object.keys(params).forEach(function (key) {
            _this.ref.instance[key] = params[key];
        });
        this.changeDetectorRef.detectChanges();
    };
    TabItem.prototype.ngOnInit = function () {
        var _this = this;
        this.ref = this.container.createComponent(this.tab.factory);
        if (this.tab.params !== void 0) {
            Object.keys(this.tab.params).forEach(function (key) {
                _this.ref.instance[key] = _this.tab.params[key];
            });
        }
        typeof this.tab.callback === 'function' && this.tab.callback(this.ref.instance);
        this.tab.forceUpdate = this.update.bind(this);
    };
    TabItem.prototype.ngOnDestroy = function () {
        this.ref.destroy();
    };
    return TabItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], TabItem.prototype, "tab", void 0);
TabItem = __decorate([
    core_1.Component({
        selector: 'tab-item',
        template: '',
    }),
    __metadata("design:paramtypes", [core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], TabItem);
exports.TabItem = TabItem;
//# sourceMappingURL=component.js.map
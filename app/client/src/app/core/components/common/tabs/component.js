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
var CommonTabs = (function () {
    function CommonTabs() {
        this.tabs = [];
        this.onResize = new core_1.EventEmitter();
        this.switched = false;
        this.attached = false;
    }
    CommonTabs.prototype.ngAfterViewChecked = function () {
        if (this.switched) {
            this.switched = false;
            this.tabs.forEach(function (_tab) {
                _tab.active && (_tab.onSelect !== void 0 && _tab.onSelect.emit());
                !_tab.active && (_tab.onDeselect !== void 0 && _tab.onDeselect.emit());
            });
        }
        if (this.onResize !== null && !this.attached) {
            this.attached = true;
            this.onResizeHandle = this.onResizeHandle.bind(this);
            this.onResize.subscribe(this.onResizeHandle);
        }
    };
    CommonTabs.prototype.ngOnDestroy = function () {
        this.onResize !== null && this.onResize.unsubscribe();
    };
    CommonTabs.prototype.onResizeHandle = function () {
        this.tabs.forEach(function (_tab) {
            _tab.active && (_tab.onSelect !== void 0 && _tab.onResize.emit());
        });
    };
    CommonTabs.prototype.onSwitch = function (tab) {
        this.tabs.forEach(function (_tab) {
            _tab.active = (tab.id === _tab.id);
        });
        this.switched = true;
    };
    return CommonTabs;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], CommonTabs.prototype, "tabs", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], CommonTabs.prototype, "onResize", void 0);
CommonTabs = __decorate([
    core_1.Component({
        selector: 'common-tabs',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], CommonTabs);
exports.CommonTabs = CommonTabs;
//# sourceMappingURL=component.js.map
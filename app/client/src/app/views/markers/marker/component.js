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
var controller_1 = require("../../../core/components/common/popup/controller");
var component_1 = require("../../../core/components/common/dialogs/markers.edit/component");
var ViewMarkersItem = (function () {
    function ViewMarkersItem(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
        this.active = true;
        this.value = '';
        this.foregroundColor = '';
        this.backgroundColor = '';
        this.onChangeColor = null;
        this.onRemove = null;
        this.onChangeState = null;
        this.onChange = null;
        this.isDblClick = false;
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
    }
    ViewMarkersItem.prototype.ngOnInit = function () {
    };
    ViewMarkersItem.prototype.ngOnDestroy = function () {
    };
    ViewMarkersItem.prototype.ngAfterViewInit = function () {
    };
    ViewMarkersItem.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewMarkersItem.prototype.onClickTrigger = function () {
        this.active = !this.active;
        typeof this.onChangeState === 'function' && this.onChangeState(this.active);
    };
    ViewMarkersItem.prototype.onClickTriggerSafe = function () {
        var _this = this;
        setTimeout(function () {
            if (!_this.isDblClick) {
                _this.active = !_this.active;
                typeof _this.onChangeState === 'function' && _this.onChangeState(_this.active);
            }
            _this.isDblClick && setTimeout(function () {
                _this.isDblClick = false;
            }, 200);
        }, 300);
    };
    ViewMarkersItem.prototype.onClickRemove = function () {
        typeof this.onRemove === 'function' && this.onRemove();
    };
    ViewMarkersItem.prototype.onClickEdit = function () {
        var popup = Symbol();
        this.isDblClick = true;
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.MarkersEditDialog,
                params: {
                    hook: this.value,
                    foregroundColor: this.foregroundColor,
                    backgroundColor: this.backgroundColor,
                    callback: function (marker) {
                        typeof this.onChange === 'function' && this.onChange(marker['hook'], marker['foregroundColor'], marker['backgroundColor']);
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Edit marker'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '25rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    return ViewMarkersItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewMarkersItem.prototype, "active", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewMarkersItem.prototype, "value", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewMarkersItem.prototype, "foregroundColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewMarkersItem.prototype, "backgroundColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewMarkersItem.prototype, "onChangeColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewMarkersItem.prototype, "onRemove", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewMarkersItem.prototype, "onChangeState", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewMarkersItem.prototype, "onChange", void 0);
ViewMarkersItem = __decorate([
    core_1.Component({
        selector: 'view-markers-item',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewMarkersItem);
exports.ViewMarkersItem = ViewMarkersItem;
//# sourceMappingURL=component.js.map
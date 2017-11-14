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
var controller_1 = require("../../../../core/components/common/popup/controller");
var component_1 = require("../../../../core/components/common/dialogs/markers.edit/component");
var ViewRequestItem = (function () {
    function ViewRequestItem(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
        this.active = true;
        this.value = '';
        this.type = '';
        this.foregroundColor = '';
        this.backgroundColor = '';
        this.onChangeColor = null;
        this.onRemove = null;
        this.onChangeState = null;
        this.onChange = null;
        this.passive = true;
        this.compact = false;
        this.isDblClick = false;
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
    }
    ViewRequestItem.prototype.ngOnInit = function () {
    };
    ViewRequestItem.prototype.ngOnDestroy = function () {
    };
    ViewRequestItem.prototype.ngAfterViewInit = function () {
    };
    ViewRequestItem.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewRequestItem.prototype.onClickTrigger = function () {
        this.active = !this.active;
        typeof this.onChangeState === 'function' && this.onChangeState(this.active);
    };
    ViewRequestItem.prototype.onClickTriggerSafe = function () {
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
    ViewRequestItem.prototype.onClickRemove = function () {
        typeof this.onRemove === 'function' && this.onRemove();
    };
    ViewRequestItem.prototype.onClickEdit = function () {
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
                    callback: function (request) {
                        typeof this.onChange === 'function' && this.onChange(request['hook'], request['foregroundColor'], request['backgroundColor'], this.type, this.passive);
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Edit request'),
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
    ViewRequestItem.prototype.onActivePassive = function (passive) {
        this.passive = passive;
        typeof this.onChange === 'function' && this.onChange(this.value, this.foregroundColor, this.backgroundColor, this.type, this.passive);
    };
    return ViewRequestItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewRequestItem.prototype, "active", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewRequestItem.prototype, "value", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewRequestItem.prototype, "type", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewRequestItem.prototype, "foregroundColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewRequestItem.prototype, "backgroundColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewRequestItem.prototype, "onChangeColor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewRequestItem.prototype, "onRemove", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewRequestItem.prototype, "onChangeState", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewRequestItem.prototype, "onChange", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewRequestItem.prototype, "passive", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewRequestItem.prototype, "compact", void 0);
ViewRequestItem = __decorate([
    core_1.Component({
        selector: 'view-request-item',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewRequestItem);
exports.ViewRequestItem = ViewRequestItem;
//# sourceMappingURL=component.js.map
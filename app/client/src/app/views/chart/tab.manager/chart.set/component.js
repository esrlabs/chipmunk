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
var controller_events_1 = require("../../../../core/modules/controller.events");
var controller_data_parsers_tracker_manager_1 = require("../../../../core/modules/parsers/controller.data.parsers.tracker.manager");
var controller_1 = require("../../../../core/components/common/popup/controller");
var component_1 = require("../../../../core/components/common/dialogs/charts.edit.colors/component");
var component_2 = require("../../../../core/components/common/dialogs/charts.edit.rules.hooks/component");
var component_3 = require("../../../../core/components/common/dialogs/charts.edit.rules.segments/component");
var ViewControllerTabChartManagerSet = (function () {
    function ViewControllerTabChartManagerSet(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        var _this = this;
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
        this.GUID = null;
        this.removeCallback = null;
        this.set = null;
        this.sets = null;
        this.manager = new controller_data_parsers_tracker_manager_1.Manager();
        this.isDblClick = false;
        [].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        //Load available sets
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    }
    ViewControllerTabChartManagerSet.prototype.ngOnInit = function () {
        if (this.GUID !== null && this.sets[this.GUID] !== void 0) {
            this.set = this.sets[this.GUID];
        }
    };
    ViewControllerTabChartManagerSet.prototype.ngAfterViewChecked = function () {
    };
    ViewControllerTabChartManagerSet.prototype.ngOnDestroy = function () {
    };
    ViewControllerTabChartManagerSet.prototype.onClickTrigger = function () {
        this.set.active = !this.set.active;
        this.onChangeState();
    };
    ViewControllerTabChartManagerSet.prototype.onClickTriggerSafe = function () {
        var _this = this;
        setTimeout(function () {
            if (!_this.isDblClick) {
                _this.set.active = !_this.set.active;
                _this.onChangeState();
            }
            _this.isDblClick && setTimeout(function () {
                _this.isDblClick = false;
            }, 200);
        }, 300);
    };
    ViewControllerTabChartManagerSet.prototype.onChangeState = function () {
        this.manager.update(this.GUID, Object.assign({}, this.set), false);
    };
    ViewControllerTabChartManagerSet.prototype.onClickRemove = function () {
        typeof this.removeCallback === 'function' && this.removeCallback();
    };
    ViewControllerTabChartManagerSet.prototype.onClickColor = function () {
        var popup = Symbol();
        this.isDblClick = true;
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ChartEditColorDialog,
                params: {
                    hook: this.GUID,
                    foregroundColor: this.set.textColor,
                    backgroundColor: this.set.lineColor,
                    callback: function (request) {
                        this.set.textColor = request['foregroundColor'];
                        this.set.lineColor = request['backgroundColor'];
                        this.manager.update(this.GUID, Object.assign({}, this.set), false);
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Change chart color'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '23rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerTabChartManagerSet.prototype.getTypeOfRules = function (GUID) {
        if (this.sets[this.GUID] !== void 0) {
            if (this.sets[this.GUID].segments !== void 0) {
                return component_3.ChartEditRulesSegmentsDialog;
            }
            else if (this.sets[this.GUID].tests !== void 0) {
                return component_2.ChartEditRulesHooksDialog;
            }
        }
        return null;
    };
    ViewControllerTabChartManagerSet.prototype.onClickEdit = function () {
        var popup = Symbol(), dialog = this.getTypeOfRules(this.GUID);
        this.isDblClick = true;
        controller_1.popupController.open({
            content: {
                factory: null,
                component: dialog,
                params: {
                    GUID: this.GUID,
                    callback: function (updated) {
                        this.set = updated;
                        this.manager.update(this.GUID, Object.assign({}, this.set));
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Change rules'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '70%',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    return ViewControllerTabChartManagerSet;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerTabChartManagerSet.prototype, "GUID", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewControllerTabChartManagerSet.prototype, "removeCallback", void 0);
ViewControllerTabChartManagerSet = __decorate([
    core_1.Component({
        selector: 'view-controller-chart-manager-set',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewControllerTabChartManagerSet);
exports.ViewControllerTabChartManagerSet = ViewControllerTabChartManagerSet;
//# sourceMappingURL=component.js.map
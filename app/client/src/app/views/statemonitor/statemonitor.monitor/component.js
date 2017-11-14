"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
var tools_logs_1 = require("../../../core/modules/tools.logs");
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_config_1 = require("../../../core/modules/controller.config");
var class_view_1 = require("../../../core/services/class.view");
var controller_localsettings_1 = require("../../../core/modules/controller.localsettings");
var class_tab_controller_1 = require("../../../core/components/common/tabs/tab/class.tab.controller");
var SETTINGS = {
    LIST_KEY: 'LIST_KEY'
};
var ViewControllerStateMonitor = (function (_super) {
    __extends(ViewControllerStateMonitor, _super);
    function ViewControllerStateMonitor(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.viewParams = null;
        _this.indicates = [];
        _this._indicates = [];
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _this.onSelectTab = _this.onSelectTab.bind(_this);
        _this.onDeselectTab = _this.onDeselectTab.bind(_this);
        _this.loadIndicates();
        _this.initIndicates();
        return _this;
    }
    ViewControllerStateMonitor.prototype.ngOnInit = function () {
        this.onSelect.subscribe(this.onSelectTab);
        this.onDeselect.subscribe(this.onDeselectTab);
        //this.emulate();
    };
    ViewControllerStateMonitor.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
        this.onSelect.unsubscribe();
        this.onDeselect.unsubscribe();
    };
    ViewControllerStateMonitor.prototype.ngAfterContentChecked = function () {
    };
    ViewControllerStateMonitor.prototype.onSelectTab = function () {
        this.loadIndicates();
        this.initIndicates();
    };
    ViewControllerStateMonitor.prototype.onDeselectTab = function () {
    };
    ViewControllerStateMonitor.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerStateMonitor.prototype.initIndicates = function () {
        var _this = this;
        this.indicates = Object.keys(this._indicates).map(function (id) {
            var indicate = Object.assign({}, _this._indicates[id]);
            indicate.updateState = new core_1.EventEmitter();
            return indicate;
        });
    };
    ViewControllerStateMonitor.prototype.checkIndicatesByStr = function (str) {
        this.indicates.forEach(function (indicate) {
            indicate.updateState.emit(str);
        });
    };
    ViewControllerStateMonitor.prototype.checkIncomeDate = function (rows) {
        var _this = this;
        if (rows instanceof Array && rows.length > 0 && this.indicates instanceof Array && this.indicates.length > 0) {
            rows.forEach(function (row) {
                _this.checkIndicatesByStr(row.str);
            });
        }
    };
    ViewControllerStateMonitor.prototype.onDATA_IS_UPDATED = function (event) {
        var measure = tools_logs_1.Logs.measure('[view.statemonitor][onDATA_IS_UPDATED]');
        this.checkIncomeDate(event.rows);
        tools_logs_1.Logs.measure(measure);
    };
    ViewControllerStateMonitor.prototype.onDATA_FILTER_IS_UPDATED = function (event) {
        if (event.rows instanceof Array) {
        }
    };
    ViewControllerStateMonitor.prototype.onDATA_IS_MODIFIED = function (event) {
        var measure = tools_logs_1.Logs.measure('[view.statemonitor][onDATA_IS_MODIFIED]');
        this.checkIncomeDate(event.rows);
        tools_logs_1.Logs.measure(measure);
    };
    ViewControllerStateMonitor.prototype.onROW_IS_SELECTED = function (index) {
    };
    ViewControllerStateMonitor.prototype.emulate = function () {
        var lines = [
            'CONTROL CENTER LOCK succeeded, vehicle unlocked',
            'CONTROL CENTER LOCK succeeded, vehicle locked',
            'CONTROL CENTER LOCK succeeded, vehicle secured',
            'DRIVER_DOOR_OPENED even',
            'DRIVER_DOOR_CLOSED event',
            'PASSENGER_DOOR_OPENED event',
            'PASSENGER_DOOR_CLOSED event',
            'ACTIVATE IMMOBILIZER succeeded',
            'DEACTIVATE IMMOBILIZER succeeded',
            'ENGINE_STARTED event',
            'ENGINE_STOPPED event',
            'CSM4 Team proudly presents:'
        ], index = Math.ceil(lines.length * Math.random());
        this.checkIndicatesByStr(lines[index <= lines.length - 1 ? index : index - 1]);
        setTimeout(this.emulate.bind(this), 500 * Math.random());
    };
    ViewControllerStateMonitor.prototype.loadIndicates = function () {
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.view_statemonitor] !== void 0
            && settings[controller_localsettings_1.KEYs.view_statemonitor] !== null
            && typeof settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY] === 'object'
            && settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY] !== null) {
            this._indicates = Object.keys(settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY]).map(function (id) {
                return Object.assign({}, settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY][id]);
            });
        }
        else {
            this._indicates = Object.keys(controller_config_1.configuration.sets.VIEW_STATEMONITOR.IndicatesRules).map(function (id) {
                return Object.assign({}, controller_config_1.configuration.sets.VIEW_STATEMONITOR.IndicatesRules[id]);
            });
        }
    };
    ViewControllerStateMonitor.prototype.saveIndicates = function () {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.view_statemonitor] = (_b = {},
                _b[SETTINGS.LIST_KEY] = this._indicates,
                _b),
            _a));
        var _a, _b;
    };
    return ViewControllerStateMonitor;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.Input(),
    __metadata("design:type", class_view_1.ViewClass)
], ViewControllerStateMonitor.prototype, "viewParams", void 0);
ViewControllerStateMonitor = __decorate([
    core_1.Component({
        selector: 'view-controller-state-monitor',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewControllerStateMonitor);
exports.ViewControllerStateMonitor = ViewControllerStateMonitor;
//# sourceMappingURL=component.js.map
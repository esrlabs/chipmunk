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
var platform_browser_1 = require("@angular/platform-browser");
var controller_pattern_1 = require("../controller.pattern");
var controller_events_1 = require("../../core/modules/controller.events");
var component_1 = require("./tab.chart/component");
var component_2 = require("./tab.manager/component");
var ViewControllerChart = (function (_super) {
    __extends(ViewControllerChart, _super);
    function ViewControllerChart(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.sanitizer = sanitizer;
        _this.viewParams = null;
        _this.tabs = [];
        _this.onResize = new core_1.EventEmitter();
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        [].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _super.prototype.getEmitters.call(_this).resize.subscribe(_this.resizeOnREMOVE_VIEW.bind(_this));
        return _this;
    }
    ViewControllerChart.prototype.ngOnInit = function () {
        this.viewParams !== null && _super.prototype.setGUID.call(this, this.viewParams.GUID);
        this.initTabs();
    };
    ViewControllerChart.prototype.ngOnDestroy = function () {
        var _this = this;
        [].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ViewControllerChart.prototype.ngAfterViewChecked = function () {
        _super.prototype.ngAfterViewChecked.call(this);
    };
    ViewControllerChart.prototype.initTabs = function () {
        var emitterChartsSelect = new core_1.EventEmitter(), emitterSettingsSelect = new core_1.EventEmitter(), emitterChartsDeselect = new core_1.EventEmitter(), emitterSettingsDeselect = new core_1.EventEmitter(), emitterChartsResize = new core_1.EventEmitter(), emitterSettingsResize = new core_1.EventEmitter();
        this.tabs.push({
            id: Symbol(),
            label: 'Charts',
            onSelect: emitterChartsSelect,
            onDeselect: emitterChartsDeselect,
            onResize: emitterChartsResize,
            factory: this.componentFactoryResolver.resolveComponentFactory(component_1.ViewControllerTabChart),
            params: {
                viewParams: this.viewParams,
                onSelect: emitterChartsSelect,
                onDeselect: emitterChartsDeselect,
                onResize: emitterChartsResize
            },
            update: null,
            active: true
        });
        this.tabs.push({
            id: Symbol(),
            label: 'Manager',
            onSelect: emitterSettingsSelect,
            onDeselect: emitterSettingsDeselect,
            onResize: emitterSettingsResize,
            factory: this.componentFactoryResolver.resolveComponentFactory(component_2.ViewControllerTabChartManager),
            params: {
                viewParams: this.viewParams,
                onSelect: emitterSettingsSelect,
                onDeselect: emitterSettingsDeselect,
                onResize: emitterSettingsResize
            },
            update: null,
            active: false
        });
    };
    ViewControllerChart.prototype.resizeOnREMOVE_VIEW = function () {
        this.onResize.emit();
    };
    return ViewControllerChart;
}(controller_pattern_1.ViewControllerPattern));
ViewControllerChart = __decorate([
    core_1.Component({
        selector: 'view-controller-chart-main',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], ViewControllerChart);
exports.ViewControllerChart = ViewControllerChart;
//# sourceMappingURL=component.js.map
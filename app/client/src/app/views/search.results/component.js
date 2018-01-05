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
var component_1 = require("./tab.results/component");
var component_2 = require("./tab.requests/component");
var ViewControllerSearchResults = (function (_super) {
    __extends(ViewControllerSearchResults, _super);
    function ViewControllerSearchResults(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
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
    ViewControllerSearchResults.prototype.ngOnInit = function () {
        this.viewParams !== null && _super.prototype.setGUID.call(this, this.viewParams.GUID);
        this.initTabs();
    };
    ViewControllerSearchResults.prototype.ngOnDestroy = function () {
        var _this = this;
        [].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ViewControllerSearchResults.prototype.ngAfterViewChecked = function () {
        _super.prototype.ngAfterViewChecked.call(this);
    };
    ViewControllerSearchResults.prototype.initTabs = function () {
        var emitterResultsSelect = new core_1.EventEmitter(), emitterRequestsSelect = new core_1.EventEmitter(), emitterResultsDeselect = new core_1.EventEmitter(), emitterRequestsDeselect = new core_1.EventEmitter(), emitterResultsResize = new core_1.EventEmitter(), emitterRequestsResize = new core_1.EventEmitter(), emitterSetLabel = new core_1.EventEmitter();
        this.tabs.push({
            id: Symbol(),
            label: 'Results',
            onSelect: emitterResultsSelect,
            onDeselect: emitterResultsDeselect,
            onResize: emitterResultsResize,
            setLabel: emitterSetLabel,
            factory: this.componentFactoryResolver.resolveComponentFactory(component_1.TabControllerSearchResults),
            params: {
                viewParams: this.viewParams,
                onSelect: emitterResultsSelect,
                onDeselect: emitterResultsDeselect,
                onResize: emitterResultsResize,
                setLabel: emitterSetLabel
            },
            update: null,
            active: true
        });
        this.tabs.push({
            id: Symbol(),
            label: 'Requests',
            onSelect: emitterRequestsSelect,
            onDeselect: emitterRequestsDeselect,
            onResize: emitterResultsResize,
            factory: this.componentFactoryResolver.resolveComponentFactory(component_2.TabControllerSearchRequests),
            params: {
                viewParams: this.viewParams,
                onSelect: emitterRequestsSelect,
                onDeselect: emitterRequestsDeselect,
                onResize: emitterResultsResize
            },
            update: null,
            active: false
        });
    };
    ViewControllerSearchResults.prototype.resizeOnREMOVE_VIEW = function () {
        this.onResize.emit();
    };
    return ViewControllerSearchResults;
}(controller_pattern_1.ViewControllerPattern));
ViewControllerSearchResults = __decorate([
    core_1.Component({
        selector: 'view-controller-search-results',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], ViewControllerSearchResults);
exports.ViewControllerSearchResults = ViewControllerSearchResults;
//# sourceMappingURL=component.js.map
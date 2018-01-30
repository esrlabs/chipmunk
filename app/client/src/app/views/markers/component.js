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
var controller_pattern_1 = require("../controller.pattern");
var controller_events_1 = require("../../core/modules/controller.events");
var controller_config_1 = require("../../core/modules/controller.config");
var controller_localsettings_1 = require("../../core/modules/controller.localsettings");
var controller_1 = require("../../core/components/common/popup/controller");
var component_1 = require("../../core/components/common/dialogs/markers.edit/component");
var SETTINGS = {
    LIST_KEY: 'LIST_KEY'
};
var MarkerSelectionModeValues = {
    words: 'words',
    lines: 'lines'
};
var ViewControllerMarkers = (function (_super) {
    __extends(ViewControllerMarkers, _super);
    function ViewControllerMarkers(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.viewParams = null;
        _this.markers = [];
        _this.linesSelection = false;
        _this.markerSelectMode = 'words';
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        [controller_config_1.configuration.sets.EVENTS_VIEWS.MARKS_VIEW_ADD,
            controller_config_1.configuration.sets.EVENTS_VIEWS.MARKS_VIEW_SWITCH_TARGET,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _this.loadMarkers();
        _this.onMarkerChanges();
        return _this;
    }
    ViewControllerMarkers.prototype.ngOnInit = function () {
        this.viewParams !== null && _super.prototype.setGUID.call(this, this.viewParams.GUID);
    };
    ViewControllerMarkers.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.EVENTS_VIEWS.MARKS_VIEW_ADD,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ViewControllerMarkers.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerMarkers.prototype.initMarker = function (marker) {
        return {
            value: marker.value,
            backgroundColor: marker.backgroundColor,
            foregroundColor: marker.foregroundColor,
            active: marker.active,
            onChangeColor: this.onMarkerColorChange.bind(this, marker.value),
            onRemove: this.onMarkerRemove.bind(this, marker.value),
            onChangeState: this.onMarkerChangeState.bind(this, marker.value),
            onChange: this.onMarkerChange.bind(this, marker.value)
        };
    };
    ViewControllerMarkers.prototype.onMarkerColorChange = function (hook, foregroundColor, backgroundColor) {
        var index = this.getMarkerIndexByHook(hook);
        if (~index) {
            this.markers[index].backgroundColor = backgroundColor;
            this.markers[index].foregroundColor = foregroundColor;
            this.onMarkerChanges();
            this.forceUpdate();
        }
    };
    ViewControllerMarkers.prototype.onMarkerRemove = function (hook) {
        var index = this.getMarkerIndexByHook(hook);
        if (~index) {
            this.markers.splice(index, 1);
            this.onMarkerChanges();
            this.forceUpdate();
        }
    };
    ViewControllerMarkers.prototype.onMarkerChangeState = function (hook, state) {
        var index = this.getMarkerIndexByHook(hook);
        if (~index) {
            this.markers[index].active = state;
            this.onMarkerChanges();
            this.forceUpdate();
        }
    };
    ViewControllerMarkers.prototype.onMarkerChange = function (hook, updated, foregroundColor, backgroundColor) {
        var index = this.getMarkerIndexByHook(hook);
        if (~index) {
            if (!~this.getMarkerIndexByHook(updated)) {
                this.markers[index] = this.initMarker({
                    value: updated,
                    foregroundColor: foregroundColor,
                    backgroundColor: backgroundColor,
                    active: this.markers[index].active
                });
            }
            else {
                this.markers[this.getMarkerIndexByHook(updated)].foregroundColor = foregroundColor;
                this.markers[this.getMarkerIndexByHook(updated)].backgroundColor = backgroundColor;
            }
            this.onMarkerChanges();
            this.forceUpdate();
        }
    };
    ViewControllerMarkers.prototype.getMarkerIndexByHook = function (hook) {
        var result = -1;
        this.markers.forEach(function (marker, index) {
            marker.value === hook && (result = index);
        });
        return result;
    };
    ViewControllerMarkers.prototype.getActiveMarkers = function () {
        return this.markers
            .filter(function (marker) {
            return marker.active;
        })
            .map(function (marker) {
            return {
                value: marker.value,
                foregroundColor: marker.foregroundColor,
                backgroundColor: marker.backgroundColor,
            };
        });
    };
    ViewControllerMarkers.prototype.onMARKS_VIEW_ADD = function (GUID) {
        if (this.viewParams.GUID === GUID) {
            var popup_1 = Symbol();
            controller_1.popupController.open({
                content: {
                    factory: null,
                    component: component_1.MarkersEditDialog,
                    params: {
                        callback: function (marker) {
                            if (!~this.getMarkerIndexByHook(marker['hook'])) {
                                this.markers.push(this.initMarker({
                                    foregroundColor: marker['foregroundColor'],
                                    backgroundColor: marker['backgroundColor'],
                                    value: marker['hook'],
                                    active: true
                                }));
                            }
                            else {
                                this.markers[this.getMarkerIndexByHook(marker['hook'])].foregroundColor = marker['foregroundColor'];
                                this.markers[this.getMarkerIndexByHook(marker['hook'])].backgroundColor = marker['backgroundColor'];
                            }
                            this.onMarkerChanges();
                            this.forceUpdate();
                            controller_1.popupController.close(popup_1);
                        }.bind(this)
                    }
                },
                title: _('Add marker'),
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
                GUID: popup_1
            });
        }
    };
    ViewControllerMarkers.prototype.onMARKS_VIEW_SWITCH_TARGET = function (GUID) {
        if (this.viewParams.GUID === GUID) {
            this.linesSelection = !this.linesSelection;
            this.markerSelectMode = this.linesSelection ? 'lines' : 'words';
            this.onMarkerChanges();
        }
    };
    ViewControllerMarkers.prototype.onMARKERS_GET_ALL = function (callback) {
        typeof callback === 'function' && callback(this.getActiveMarkers(), this.markerSelectMode);
    };
    ViewControllerMarkers.prototype.onMarkerChanges = function () {
        this.saveMarkers();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED, this.getActiveMarkers(), this.markerSelectMode);
    };
    ViewControllerMarkers.prototype.loadMarkers = function () {
        var _this = this;
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.view_markers] !== void 0 && settings[controller_localsettings_1.KEYs.view_markers] !== null && settings[controller_localsettings_1.KEYs.view_markers][SETTINGS.LIST_KEY] instanceof Array) {
            this.markers = settings[controller_localsettings_1.KEYs.view_markers][SETTINGS.LIST_KEY].map(function (marker) {
                return _this.initMarker(marker);
            });
        }
    };
    ViewControllerMarkers.prototype.saveMarkers = function () {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.view_markers] = (_b = {},
                _b[SETTINGS.LIST_KEY] = this.markers.map(function (marker) {
                    return {
                        value: marker.value,
                        backgroundColor: marker.backgroundColor,
                        foregroundColor: marker.foregroundColor,
                        active: marker.active
                    };
                }),
                _b),
            _a));
        var _a, _b;
    };
    return ViewControllerMarkers;
}(controller_pattern_1.ViewControllerPattern));
ViewControllerMarkers = __decorate([
    core_1.Component({
        selector: 'view-controller-markers',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewControllerMarkers);
exports.ViewControllerMarkers = ViewControllerMarkers;
//# sourceMappingURL=component.js.map
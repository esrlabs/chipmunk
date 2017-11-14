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
var controller_config_1 = require("../../../../core/modules/controller.config");
var CurrentState = (function () {
    function CurrentState() {
        this.css = '';
        this.icon = '';
        this.label = '';
        this.color = '';
    }
    return CurrentState;
}());
var BOUND = '__bound';
var ViewControllerStateMonitorItem = (function () {
    function ViewControllerStateMonitorItem(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.indicate = null;
        this.state = null;
        this.GUID = Symbol();
        this.changeDetectorRef = changeDetectorRef;
        this.updateState = this.updateState.bind(this);
        this.onRESET_ALL_INDICATES = this.onRESET_ALL_INDICATES.bind(this);
        controller_events_1.events.bind(controller_config_1.configuration.sets.VIEW_STATEMONITOR.IndicateEvents.RESET_ALL_INDICATES, this.onRESET_ALL_INDICATES);
    }
    ViewControllerStateMonitorItem.prototype.ngOnDestroy = function () {
        this.update.unsubscribe();
        delete this.updateState[BOUND];
        controller_events_1.events.unbind(controller_config_1.configuration.sets.VIEW_STATEMONITOR.IndicateEvents.RESET_ALL_INDICATES, this.onRESET_ALL_INDICATES);
    };
    ViewControllerStateMonitorItem.prototype.ngAfterContentChecked = function () {
        this.updateDefaultState();
        if (this.updateState[BOUND] === void 0) {
            this.updateState[BOUND] = true;
            this.update.subscribe(this.updateState);
        }
    };
    ViewControllerStateMonitorItem.prototype.ngOnChanges = function () {
    };
    ViewControllerStateMonitorItem.prototype.onRESET_ALL_INDICATES = function (GUID) {
        if (this.GUID !== GUID) {
            this.state = null;
            this.updateDefaultState();
            this.forceUpdate();
        }
    };
    ViewControllerStateMonitorItem.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerStateMonitorItem.prototype.updateState = function (str) {
        if (this.indicate !== null && this.indicate.states instanceof Array && this.indicate.states.length > 0) {
            var state_1 = null;
            this.indicate.states.forEach(function (_state) {
                if (typeof _state.hook === 'string' && _state.hook !== '') {
                    ~str.indexOf(_state.hook) && (state_1 = _state);
                }
            });
            state_1 !== null && this.applyState(state_1);
        }
    };
    ViewControllerStateMonitorItem.prototype.applyState = function (state) {
        var _this = this;
        this.getDefaultStateIndex();
        this.state = new CurrentState();
        state.css !== void 0 && (this.state.css = state.css);
        state.icon !== void 0 && (this.state.icon = state.icon);
        state.label !== void 0 && (this.state.label = state.label);
        state.color !== void 0 && (this.state.color = state.color);
        if (typeof state.offInTimeout === 'number') {
            setTimeout(function () {
                _this.state = null;
                _this.updateDefaultState();
            }, state.offInTimeout);
        }
        if (state.event instanceof Array) {
            state.event.forEach(function (event) {
                controller_events_1.events.trigger(event, _this.GUID);
            });
        }
    };
    ViewControllerStateMonitorItem.prototype.getDefaultStateIndex = function () {
        var _this = this;
        if (this.indicate.defaultState === void 0) {
            this.indicate.defaultState = -1;
            this.indicate.states.forEach(function (state, index) {
                state.defaults && (_this.indicate.defaultState = index);
            });
        }
    };
    ViewControllerStateMonitorItem.prototype.updateDefaultState = function () {
        this.getDefaultStateIndex();
        if (this.state === null && this.indicate.defaultState !== void 0 && this.indicate.defaultState !== -1) {
            var defaults = this.indicate.defaultState;
            if (this.indicate.states[defaults] !== void 0) {
                this.state = new CurrentState();
                this.indicate.states[defaults].css !== void 0 && (this.state.css = this.indicate.states[defaults].css);
                this.indicate.states[defaults].icon !== void 0 && (this.state.icon = this.indicate.states[defaults].icon);
                this.indicate.states[defaults].label !== void 0 && (this.state.label = this.indicate.states[defaults].label);
                this.indicate.states[defaults].color !== void 0 && (this.state.color = this.indicate.states[defaults].color);
            }
        }
        else if (this.state === null) {
            this.state = new CurrentState();
            this.indicate.css !== void 0 && (this.state.css = this.indicate.css);
            this.indicate.icon !== void 0 && (this.state.icon = this.indicate.icon);
            this.indicate.label !== void 0 && (this.state.label = this.indicate.label);
        }
    };
    return ViewControllerStateMonitorItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], ViewControllerStateMonitorItem.prototype, "indicate", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], ViewControllerStateMonitorItem.prototype, "update", void 0);
ViewControllerStateMonitorItem = __decorate([
    core_1.Component({
        selector: 'view-controller-state-monitor-item',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ViewControllerStateMonitorItem);
exports.ViewControllerStateMonitorItem = ViewControllerStateMonitorItem;
//# sourceMappingURL=component.js.map
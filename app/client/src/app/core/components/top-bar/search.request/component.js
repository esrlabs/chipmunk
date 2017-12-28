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
/*global _*/
var core_1 = require("@angular/core");
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var controller_data_search_modes_1 = require("../../../modules/controller.data.search.modes");
var interface_data_filter_1 = require("../../../interfaces/interface.data.filter");
var component_1 = require("../../common/input/component");
var SETTINGS = {
    TYPING_DELAY: 300 //ms
};
var TopBarSearchRequest = (function () {
    function TopBarSearchRequest(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.delayTimer = -1;
        this.mode = controller_data_search_modes_1.MODES.REG;
        this.autoplay = false;
        this.inprogress = false;
        this.lastRequest = null;
        this.value = '';
        this.placeholder = 'type your search request';
        this.type = 'text';
        this.handles = {
            onFocus: this.onFocus.bind(this),
            onBlur: this.onBlur.bind(this),
            onKeyDown: this.onKeyDown.bind(this),
            onKeyUp: this.onKeyUp.bind(this),
            onChange: this.onChange.bind(this),
        };
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START, this.onSEARCH_REQUEST_PROCESS_START.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, this.onSEARCH_REQUEST_PROCESS_FINISH.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET, this.onSEARCH_REQUEST_RESET.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED, this.onSEARCH_REQUEST_CHANGED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_SEARCH, this.onSHORTCUT_TO_SEARCH.bind(this));
    }
    TopBarSearchRequest.prototype.onSHORTCUT_TO_SEARCH = function () {
        this.input.setFocus();
    };
    TopBarSearchRequest.prototype.ngAfterContentInit = function () {
        this.input.setFocus();
    };
    TopBarSearchRequest.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
        //this.input.setValue(this.value);
    };
    TopBarSearchRequest.prototype.onFocus = function (event) {
        //this.value = Math.random() + '';
    };
    TopBarSearchRequest.prototype.onBlur = function (event) {
    };
    TopBarSearchRequest.prototype.onKeyDown = function (event) {
    };
    TopBarSearchRequest.prototype.onKeyUp = function (event) {
        if (this.autoplay) {
            ~this.delayTimer && clearTimeout(this.delayTimer);
            this.delayTimer = setTimeout(this.trigger_SEARCH_REQUEST_CHANGED.bind(this, event), SETTINGS.TYPING_DELAY);
        }
        else if (event.keyCode === 13) {
            this.trigger_SEARCH_REQUEST_CHANGED(event);
        }
    };
    TopBarSearchRequest.prototype.onChange = function (event) {
    };
    TopBarSearchRequest.prototype.trigger_SEARCH_REQUEST_CHANGED = function (event) {
        var input = event.target;
        this.value = input.value;
        this.delayTimer = -1;
        this.onSEARCH_REQUEST_PROCESS_START();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED, (new interface_data_filter_1.DataFilter(this.mode, this.value)));
    };
    TopBarSearchRequest.prototype.onModeReg = function () {
        this.mode = this.mode === controller_data_search_modes_1.MODES.REG ? controller_data_search_modes_1.MODES.TEXT : controller_data_search_modes_1.MODES.REG;
    };
    TopBarSearchRequest.prototype.onAutoPlay = function () {
        this.autoplay = !this.autoplay;
    };
    TopBarSearchRequest.prototype.onAddRequest = function () {
        this.lastRequest !== null && controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED, this.lastRequest);
        this.lastRequest = null;
    };
    TopBarSearchRequest.prototype.onSEARCH_REQUEST_PROCESS_START = function () {
        this.inprogress = true;
        this.forceUpdate();
    };
    TopBarSearchRequest.prototype.onSEARCH_REQUEST_PROCESS_FINISH = function () {
        this.inprogress = false;
        this.forceUpdate();
    };
    TopBarSearchRequest.prototype.onSEARCH_REQUEST_RESET = function () {
        this.value = '';
        this.forceUpdate();
    };
    TopBarSearchRequest.prototype.onSEARCH_REQUEST_CHANGED = function (event) {
        this.lastRequest = Object.assign({}, event);
    };
    return TopBarSearchRequest;
}());
__decorate([
    core_1.ViewChild('input'),
    __metadata("design:type", component_1.CommonInput)
], TopBarSearchRequest.prototype, "input", void 0);
TopBarSearchRequest = __decorate([
    core_1.Component({
        selector: 'topbar-search-request',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], TopBarSearchRequest);
exports.TopBarSearchRequest = TopBarSearchRequest;
//# sourceMappingURL=component.js.map
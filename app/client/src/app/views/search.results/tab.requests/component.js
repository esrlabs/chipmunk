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
var controller_data_1 = require("../../../core/modules/controller.data");
var controller_config_1 = require("../../../core/modules/controller.config");
var controller_events_1 = require("../../../core/modules/controller.events");
var class_tab_controller_1 = require("../../../core/components/common/tabs/tab/class.tab.controller");
var tools_logs_1 = require("../../../core/modules/tools.logs");
var controller_localsettings_1 = require("../../../core/modules/controller.localsettings");
var SETTINGS = {
    //FOREGROUND_COLOR    : 'rgb(20,20, 20)',
    //BACKGROUND_COLOR    : 'rgb(255,255,255)',
    FOREGROUND_COLOR: '',
    BACKGROUND_COLOR: '',
    LIST_KEY: 'ListOfRequests'
};
var TabControllerSearchRequests = (function (_super) {
    __extends(TabControllerSearchRequests, _super);
    function TabControllerSearchRequests(viewContainerRef, changeDetectorRef) {
        var _this = _super.call(this) || this;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.requests = [];
        _this.currentRequest = null;
        _this.onTabSelected = _this.onTabSelected.bind(_this);
        _this.onTabDeselected = _this.onTabDeselected.bind(_this);
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _this.loadRequests();
        _this.onRequestsChanges();
        return _this;
    }
    TabControllerSearchRequests.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
        this.onSelect.unsubscribe();
        this.onDeselect.unsubscribe();
    };
    TabControllerSearchRequests.prototype.ngOnInit = function () {
        this.onSelect.subscribe(this.onTabSelected);
        this.onDeselect.subscribe(this.onTabDeselected);
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchRequests.prototype.onTabSelected = function () {
    };
    TabControllerSearchRequests.prototype.onTabDeselected = function () {
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Core events
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchRequests.prototype.onDATA_FILTER_IS_UPDATED = function (event) {
    };
    TabControllerSearchRequests.prototype.onSEARCH_REQUEST_CHANGED = function (event) {
        if (event.value !== '') {
            this.currentRequest = this.initRequest({
                GUID: controller_data_1.dataController.getRequestGUID(event.mode, event.value),
                value: event.value,
                type: event.mode,
                foregroundColor: SETTINGS.FOREGROUND_COLOR,
                backgroundColor: SETTINGS.BACKGROUND_COLOR,
                active: true,
                passive: false
            });
            this.onRequestsChanges();
        }
    };
    TabControllerSearchRequests.prototype.onSEARCH_REQUEST_ACCEPTED = function (event) {
        if (!this.isExist(event.mode, event.value) && event.value !== '') {
            this.requests.push(this.initRequest({
                GUID: controller_data_1.dataController.getRequestGUID(event.mode, event.value),
                value: event.value,
                type: event.mode,
                foregroundColor: SETTINGS.FOREGROUND_COLOR,
                backgroundColor: SETTINGS.BACKGROUND_COLOR,
                active: true,
                passive: false
            }));
            this.onRequestsChanges();
        }
    };
    TabControllerSearchRequests.prototype.onREQUESTS_HISTORY_GET_ALL = function (callback) {
        typeof callback === 'function' && callback(this.getActiveRequests());
    };
    TabControllerSearchRequests.prototype.onDATA_IS_UPDATED = function (event) {
        if (event.rows instanceof Array) {
            var measure = tools_logs_1.Logs.measure('[view.search.results.requests][onDATA_IS_UPDATED]');
            this.updateSearchResults();
            tools_logs_1.Logs.measure(measure);
        }
    };
    TabControllerSearchRequests.prototype.onDATA_IS_MODIFIED = function (event) {
        if (event.rows instanceof Array) {
        }
    };
    TabControllerSearchRequests.prototype.onREQUESTS_HISTORY_UPDATED_OUTSIDE = function (requests) {
        var _this = this;
        this.requests = requests.map(function (request) {
            return _this.initRequest(request);
        });
        this.onRequestsChanges();
        this.forceUpdate();
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Requests stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchRequests.prototype.updateSearchResults = function (current) {
        if (current === void 0) { current = false; }
        if (!current) {
            var measure = tools_logs_1.Logs.measure('[view.search.results.requests][updateSearchResults]');
            this.requests.forEach(function (request) {
                request.active && controller_data_1.dataController.updateForFilter({
                    mode: request.type,
                    value: request.value
                });
            });
            tools_logs_1.Logs.measure(measure);
        }
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_APPLIED, controller_data_1.dataController.getRows());
    };
    TabControllerSearchRequests.prototype.isExist = function (mode, value) {
        var result = false;
        this.requests.forEach(function (request) {
            if (request.type === mode && request.value === value) {
                result = true;
            }
        });
        return result;
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchRequests.prototype.initRequest = function (request) {
        return {
            GUID: controller_data_1.dataController.getRequestGUID(request.type, request.value),
            value: request.value,
            backgroundColor: request.backgroundColor,
            foregroundColor: request.foregroundColor,
            active: request.active,
            type: request.type,
            passive: request.passive,
            onChangeColor: this.onRequestColorChange.bind(this, request.value),
            onRemove: this.onRequestRemove.bind(this, request.value),
            onChangeState: this.onRequestChangeState.bind(this, request.value),
            onChange: this.onRequestChange.bind(this, request.value)
        };
    };
    TabControllerSearchRequests.prototype.onRequestColorChange = function (hook, foregroundColor, backgroundColor) {
        var index = this.getRequestIndexByHook(hook);
        if (~index) {
            this.requests[index].backgroundColor = backgroundColor;
            this.requests[index].foregroundColor = foregroundColor;
            this.onRequestsChanges();
            this.forceUpdate();
        }
    };
    TabControllerSearchRequests.prototype.onRequestRemove = function (hook) {
        var index = this.getRequestIndexByHook(hook);
        if (~index) {
            this.requests.splice(index, 1);
            this.onRequestsChanges();
            this.forceUpdate();
        }
    };
    TabControllerSearchRequests.prototype.onRequestChangeState = function (hook, state) {
        var index = this.getRequestIndexByHook(hook);
        if (~index) {
            this.requests[index].active = state;
            this.onRequestsChanges();
            this.forceUpdate();
        }
    };
    TabControllerSearchRequests.prototype.onRequestChange = function (hook, updated, foregroundColor, backgroundColor, type, passive) {
        var index = this.getRequestIndexByHook(hook);
        if (~index) {
            if (!~this.getRequestIndexByHook(updated)) {
                this.requests[index] = this.initRequest({
                    GUID: controller_data_1.dataController.getRequestGUID(type, updated),
                    value: updated,
                    type: type,
                    foregroundColor: foregroundColor,
                    backgroundColor: backgroundColor,
                    active: this.requests[index].active,
                    passive: passive
                });
            }
            else {
                var index_1 = this.getRequestIndexByHook(updated);
                this.requests[index_1].foregroundColor = foregroundColor;
                this.requests[index_1].backgroundColor = backgroundColor;
                this.requests[index_1].type = type;
                this.requests[index_1].passive = passive;
            }
            this.onRequestsChanges();
            this.forceUpdate();
        }
    };
    TabControllerSearchRequests.prototype.getRequestIndexByHook = function (hook) {
        var result = -1;
        this.requests.forEach(function (request, index) {
            request.value === hook && (result = index);
        });
        return result;
    };
    TabControllerSearchRequests.prototype.getActiveRequests = function () {
        return this.requests
            .filter(function (request) {
            return request.active;
        })
            .map(function (request) {
            return {
                GUID: controller_data_1.dataController.getRequestGUID(request.type, request.value),
                value: request.value,
                passive: request.passive,
                type: request.type,
                foregroundColor: request.foregroundColor,
                backgroundColor: request.backgroundColor,
            };
        });
    };
    TabControllerSearchRequests.prototype.getCurrentRequest = function () {
        return this.currentRequest !== null ? [{
                GUID: controller_data_1.dataController.getRequestGUID(this.currentRequest.type, this.currentRequest.value),
                value: this.currentRequest.value,
                passive: this.currentRequest.passive,
                type: this.currentRequest.type,
                foregroundColor: this.currentRequest.foregroundColor,
                backgroundColor: this.currentRequest.backgroundColor,
            }] : [];
    };
    TabControllerSearchRequests.prototype.getRequests = function () {
        return this.requests.map(function (request) {
            return {
                GUID: controller_data_1.dataController.getRequestGUID(request.type, request.value),
                value: request.value,
                passive: request.passive,
                type: request.type,
                foregroundColor: request.foregroundColor,
                backgroundColor: request.backgroundColor,
                active: request.active
            };
        });
    };
    TabControllerSearchRequests.prototype.onRequestsChanges = function () {
        if (this.getActiveRequests().length === 0) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED, this.getCurrentRequest(), this.getRequests());
            this.updateSearchResults(true);
        }
        else {
            this.saveRequests();
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED, this.getActiveRequests(), this.getRequests());
            this.updateSearchResults();
        }
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Service stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchRequests.prototype.getSerializedRequests = function () {
        return this.requests.map(function (request) {
            return {
                value: request.value,
                type: request.type,
                backgroundColor: request.backgroundColor,
                foregroundColor: request.foregroundColor,
                passive: request.passive,
                active: request.active
            };
        });
    };
    TabControllerSearchRequests.prototype.loadRequests = function () {
        var _this = this;
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.view_searchrequests] !== void 0 && settings[controller_localsettings_1.KEYs.view_searchrequests] !== null && settings[controller_localsettings_1.KEYs.view_searchrequests][SETTINGS.LIST_KEY] instanceof Array) {
            this.requests = settings[controller_localsettings_1.KEYs.view_searchrequests][SETTINGS.LIST_KEY].map(function (request) {
                return _this.initRequest(request);
            });
        }
    };
    TabControllerSearchRequests.prototype.saveRequests = function () {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.view_searchrequests] = (_b = {},
                _b[SETTINGS.LIST_KEY] = this.getSerializedRequests(),
                _b),
            _a));
        var _a, _b;
    };
    TabControllerSearchRequests.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    return TabControllerSearchRequests;
}(class_tab_controller_1.TabController));
TabControllerSearchRequests = __decorate([
    core_1.Component({
        selector: 'tab-search-requests',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], TabControllerSearchRequests);
exports.TabControllerSearchRequests = TabControllerSearchRequests;
//# sourceMappingURL=component.js.map
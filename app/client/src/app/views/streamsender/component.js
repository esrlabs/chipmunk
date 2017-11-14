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
var tools_guid_1 = require("../../core/modules/tools.guid");
var controller_localsettings_1 = require("../../core/modules/controller.localsettings");
var SETTINGS = {
    VERIFYING_TIMEOUT: 5000,
    SENDING_ATTEMPTS: 0,
    HISTORY_KEY: 'history'
};
var Journal = (function () {
    function Journal(GUID, buffer) {
        this.GUID = '';
        this.buffer = '';
        this.incomes = 0;
        this.attempts = 0;
        this.GUID = GUID;
        this.buffer = buffer;
        this.incomes = 0;
        this.attempts = 0;
    }
    Journal.prototype.isConfirmed = function (income) {
        var _income = income.replace(/[\n\r]/gi, '');
        if (~_income.indexOf(this.buffer)) {
            return true;
        }
        else {
            this.incomes += 1;
            return false;
        }
    };
    Journal.prototype.getIncomes = function () {
        return this.incomes;
    };
    Journal.prototype.addAttempt = function () {
        this.attempts += 1;
        return this.attempts;
    };
    Journal.prototype.setAttempt = function (value) {
        this.attempts = value;
    };
    Journal.prototype.getAttempts = function () {
        return this.attempts;
    };
    Journal.prototype.getBuffer = function () {
        return this.buffer;
    };
    Journal.prototype.getGUID = function () {
        return this.GUID;
    };
    return Journal;
}());
;
var ViewControllerStreamSender = (function (_super) {
    __extends(ViewControllerStreamSender, _super);
    function ViewControllerStreamSender(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.STATES = {
            TYPING: Symbol(),
            SENDING: Symbol(),
            VERIFYING: Symbol(),
            REPEATING: Symbol(),
            FAILED: Symbol()
        };
        _this.viewParams = null;
        _this.value = '';
        _this.packageGUID = null;
        _this.verityTimer = -1;
        _this.history = [];
        _this.STATE = _this.STATES.TYPING;
        _this.journal = null;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.onCancel = _this.onCancel.bind(_this);
        _this.onRepeat = _this.onRepeat.bind(_this);
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _this.loadHistory();
        return _this;
    }
    ViewControllerStreamSender.prototype.ngOnInit = function () {
        this.viewParams !== null && _super.prototype.setGUID.call(this, this.viewParams.GUID);
    };
    ViewControllerStreamSender.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_TO_SERIAL_SENT,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ViewControllerStreamSender.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerStreamSender.prototype.getIndexInHistory = function (value) {
        return this.history.findIndex(function (item) {
            return item.item.value === value;
        });
    };
    ViewControllerStreamSender.prototype.getCurrentTime = function () {
        function fill(num) {
            return num >= 10 ? ('' + num) : ('0' + num);
        }
        var time = new Date();
        return fill(time.getHours()) + ':' + fill(time.getMinutes()) + ':' + fill(time.getSeconds());
    };
    ViewControllerStreamSender.prototype.loadHistory = function () {
        var _this = this;
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.view_serialsender] !== void 0 && settings[controller_localsettings_1.KEYs.view_serialsender] !== null && settings[controller_localsettings_1.KEYs.view_serialsender][SETTINGS.HISTORY_KEY] instanceof Array) {
            this.history = settings[controller_localsettings_1.KEYs.view_serialsender][SETTINGS.HISTORY_KEY].map(function (item) {
                return {
                    item: item,
                    onChange: new core_1.EventEmitter(),
                    onTyping: new core_1.EventEmitter(),
                    onRemove: _this.onRemove.bind(_this, item['value']),
                    onSelect: _this.onSelect.bind(_this, item['value']),
                };
            });
        }
    };
    ViewControllerStreamSender.prototype.saveHistory = function () {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.view_serialsender] = (_b = {},
                _b[SETTINGS.HISTORY_KEY] = this.history.map(function (element) {
                    return element.item;
                }),
                _b),
            _a));
        var _a, _b;
    };
    ViewControllerStreamSender.prototype.addToHistory = function (value) {
        var index = this.getIndexInHistory(value);
        if (value.trim() !== '') {
            if (!~index) {
                this.history.push({
                    item: {
                        value: value,
                        usage: 1,
                        time: this.getCurrentTime(),
                        stamp: (new Date).getTime(),
                        match: false,
                        selected: false
                    },
                    onChange: new core_1.EventEmitter(),
                    onTyping: new core_1.EventEmitter(),
                    onRemove: this.onRemove.bind(this, value),
                    onSelect: this.onSelect.bind(this, value),
                });
            }
            else {
                this.history[index].item.usage += 1;
                this.history[index].item.time = this.getCurrentTime();
                this.history[index].item.stamp = (new Date).getTime();
                this.history[index].onChange.emit(this.history[index].item);
            }
            this.saveHistory();
            this.forceUpdate();
        }
    };
    ViewControllerStreamSender.prototype.updateSelecting = function (str) {
        this.history.forEach(function (item) {
            item.onTyping.emit(str);
            if (str !== '') {
                item.item.match = item.item.value.indexOf(str) === 0 ? true : false;
            }
            else {
                item.item.match = false;
            }
        });
    };
    ViewControllerStreamSender.prototype.updateSorting = function () {
        var match = false;
        this.history.sort(function (a, b) {
            var matchRate = 99999999, usageA = a.item.match ? (matchRate + a.item.usage) : a.item.usage, usageB = b.item.match ? (matchRate + b.item.usage) : b.item.usage;
            match = a.item.match ? true : (b.item.match ? true : match);
            return usageB - usageA;
        });
        if (match) {
            this.setSelected(0);
        }
        else {
            this.setSelected(-1);
        }
    };
    ViewControllerStreamSender.prototype.setSelected = function (index) {
        this.history.forEach(function (item, _index) {
            item.item.selected = (index === _index);
        });
    };
    ViewControllerStreamSender.prototype.getSelected = function () {
        var index = -1;
        this.history.forEach(function (item, _index) {
            index = item.item.selected ? _index : index;
        });
        return index;
    };
    ViewControllerStreamSender.prototype.onRemove = function (str) {
        var index = this.getIndexInHistory(str);
        if (~index) {
            this.history.splice(index, 1);
            this.updateSorting();
            this.saveHistory();
            this.forceUpdate();
        }
    };
    ViewControllerStreamSender.prototype.onSelect = function (str) {
        this.value = str;
        this.updateSelecting(str);
        this.updateSorting();
        this.forceUpdate();
    };
    ViewControllerStreamSender.prototype.onSelectUp = function () {
        var selected = this.getSelected();
        selected -= 1;
        selected = selected < 0 ? 0 : selected;
        this.setSelected(selected);
    };
    ViewControllerStreamSender.prototype.onSelectDown = function () {
        var selected = this.getSelected();
        selected += 1;
        selected = selected > (this.history.length - 1) ? (this.history.length - 1) : selected;
        this.setSelected(selected);
    };
    ViewControllerStreamSender.prototype.onChooseSelection = function () {
        var selected = this.getSelected();
        ~selected && this.onSelect(this.history[selected].item.value);
    };
    ViewControllerStreamSender.prototype.onDATA_IS_UPDATED = function (event) {
    };
    ViewControllerStreamSender.prototype.onDATA_FILTER_IS_UPDATED = function (event) {
    };
    ViewControllerStreamSender.prototype.onDATA_IS_MODIFIED = function (event) {
    };
    ViewControllerStreamSender.prototype.onROW_IS_SELECTED = function (index) {
    };
    ViewControllerStreamSender.prototype.onSTREAM_DATA_UPDATE = function (str) {
        if (this.STATE === this.STATES.VERIFYING) {
            if (this.journal.isConfirmed(str)) {
                this.journal = null;
                this.packageGUID = null;
                this.value = '';
                this.STATE = this.STATES.TYPING;
                this.verityTimer !== -1 && (clearTimeout(this.verityTimer));
                this.verityTimer = -1;
            }
            this.forceUpdate();
        }
    };
    ViewControllerStreamSender.prototype.onDATA_TO_SERIAL_SENT = function (params) {
        if (params.packageGUID === this.packageGUID) {
            this.verityTimer = setTimeout(this.onVerityTimer.bind(this, this.packageGUID), SETTINGS.VERIFYING_TIMEOUT);
            this.STATE = this.STATES.VERIFYING;
        }
    };
    ViewControllerStreamSender.prototype.onVerityTimer = function (GUID) {
        if (this.journal.addAttempt() <= SETTINGS.SENDING_ATTEMPTS) {
            this.STATE = this.STATES.REPEATING;
            this.sendPackage(GUID, this.journal.getBuffer(), this.journal);
        }
        else {
            this.STATE = this.STATES.FAILED;
        }
    };
    ViewControllerStreamSender.prototype.sendPackage = function (GUID, buffer, journal) {
        if (journal === void 0) { journal = null; }
        this.packageGUID = GUID;
        this.value = buffer;
        journal === null && (this.journal = new Journal(GUID, buffer));
        journal === null && (this.addToHistory(buffer));
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.READY_TO_SEND_DATA_TO_SERIAL, {
            packageGUID: this.packageGUID,
            buffer: this.value + '\n\r' + ' ',
        });
        this.updateSelecting('');
        this.updateSorting();
        this.forceUpdate();
    };
    ViewControllerStreamSender.prototype.onKeyPress = function (event) {
        if (event.keyCode === 13 && this.packageGUID === null) {
            if (this.value.trim().length > 0) {
                this.STATE = this.STATES.SENDING;
                this.sendPackage(tools_guid_1.GUID.generate(), this.value, null);
            }
            event.preventDefault();
        }
    };
    ViewControllerStreamSender.prototype.onKeyUp = function (event) {
        if (!~[13, 37, 38, 39, 9, 40].indexOf(event.keyCode) && this.packageGUID === null) {
            this.updateSelecting(event.target.value);
            this.updateSorting();
            this.forceUpdate();
        }
    };
    ViewControllerStreamSender.prototype.onKeyDown = function (event) {
        switch (event.keyCode) {
            case 38:
                this.onSelectUp();
                event.preventDefault();
                return false;
            case 9:
                this.onChooseSelection();
                event.preventDefault();
                return false;
            case 40:
                this.onSelectDown();
                event.preventDefault();
                return false;
        }
    };
    ViewControllerStreamSender.prototype.onCancel = function () {
        this.packageGUID = null;
        this.STATE = this.STATES.TYPING;
        this.verityTimer !== -1 && (clearTimeout(this.verityTimer));
        this.verityTimer = -1;
        this.forceUpdate();
    };
    ViewControllerStreamSender.prototype.onRepeat = function () {
        this.journal.setAttempt(0);
        this.sendPackage(this.journal.getGUID(), this.journal.getBuffer(), this.journal);
    };
    ViewControllerStreamSender.prototype.onFocus = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
    };
    ViewControllerStreamSender.prototype.onBlur = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
    };
    return ViewControllerStreamSender;
}(controller_pattern_1.ViewControllerPattern));
__decorate([
    core_1.ViewChild('input', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ViewControllerStreamSender.prototype, "input", void 0);
ViewControllerStreamSender = __decorate([
    core_1.Component({
        selector: 'view-controller-stream-sender',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewControllerStreamSender);
exports.ViewControllerStreamSender = ViewControllerStreamSender;
//# sourceMappingURL=component.js.map
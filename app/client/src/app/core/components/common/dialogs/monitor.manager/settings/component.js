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
var component_1 = require("../../../input/component");
var controller_1 = require("../../../popup/controller");
var component_2 = require("../../serial.settings/component");
var class_tab_controller_1 = require("../../../../common/tabs/tab/class.tab.controller");
var defaults_settings_1 = require("../../serial.settings/defaults.settings");
var component_3 = require("../../../progressbar.circle/component");
var component_4 = require("../../../lists/simple-drop-down/component");
var DialogMonitorManagerSettingTab = (function (_super) {
    __extends(DialogMonitorManagerSettingTab, _super);
    function DialogMonitorManagerSettingTab(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.maxFileSizeMB = 100;
        _this.maxFilesCount = 10;
        _this.port = '';
        _this.portSettings = {};
        _this.ports = [];
        _this.state = {
            active: false,
            port: ''
        };
        _this.stopAndClearMonitor = null;
        _this.restartMonitor = null;
        _this.setSettingsOfMonitor = null;
        _this.clearLogsOfMonitor = null;
        _this.getStateMonitor = null;
        _this.portsList = [];
        _this.onTabSelected = _this.onTabSelected.bind(_this);
        _this.onTabDeselected = _this.onTabDeselected.bind(_this);
        _this.onClearLogsOfMonitor = _this.onClearLogsOfMonitor.bind(_this);
        _this.onRestartMonitor = _this.onRestartMonitor.bind(_this);
        _this.onSetSettingsOfMonitor = _this.onSetSettingsOfMonitor.bind(_this);
        _this.onStopMonitor = _this.onStopMonitor.bind(_this);
        return _this;
    }
    DialogMonitorManagerSettingTab.prototype.ngOnInit = function () {
        this.onSelect.subscribe(this.onTabSelected);
        this.onDeselect.subscribe(this.onTabDeselected);
    };
    DialogMonitorManagerSettingTab.prototype.ngOnDestroy = function () {
        this.onSelect.unsubscribe();
        this.onDeselect.unsubscribe();
    };
    DialogMonitorManagerSettingTab.prototype.ngAfterContentInit = function () {
        if (this.ports instanceof Array) {
            this.portsList = this.ports.map(function (port) {
                return {
                    caption: port,
                    value: port
                };
            });
        }
    };
    DialogMonitorManagerSettingTab.prototype.showProgress = function (caption) {
        var GUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_3.ProgressBarCircle,
                params: {}
            },
            title: caption,
            settings: {
                move: false,
                resize: false,
                width: '20rem',
                height: '10rem',
                close: false,
                addCloseHandle: false,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
        return GUID;
    };
    DialogMonitorManagerSettingTab.prototype.onTabSelected = function () {
    };
    DialogMonitorManagerSettingTab.prototype.onTabDeselected = function () {
    };
    DialogMonitorManagerSettingTab.prototype.showPortSettings = function () {
        var GUID = Symbol();
        var settings = typeof this.portSettings === 'object' ? (this.portSettings !== null ? this.portSettings : {}) : {};
        var params = Object.assign({
            proceed: function (GUID, settings) {
                this.portSettings = settings;
                controller_1.popupController.close(GUID);
            }.bind(this, GUID),
            cancel: function (GUID) {
                controller_1.popupController.close(GUID);
            }.bind(this, GUID)
        }, settings);
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.DialogSerialSettings,
                params: params
            },
            title: _('Configuration of port: '),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '35rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    DialogMonitorManagerSettingTab.prototype.onClearLogsOfMonitor = function () {
        var _this = this;
        var GUID = this.showProgress('Please wait...');
        this.clearLogsOfMonitor(function (result) {
            _this.getStateMonitor(function (state) {
                _this.state = state !== null ? state : { active: false, port: '' };
                controller_1.popupController.close(GUID);
                _this.forceUpdate();
            });
        });
    };
    DialogMonitorManagerSettingTab.prototype.onRestartMonitor = function () {
        var _this = this;
        var GUID = this.showProgress('Please wait...');
        this.restartMonitor(function (result) {
            _this.getStateMonitor(function (state) {
                _this.state = state !== null ? state : { active: false, port: '' };
                controller_1.popupController.close(GUID);
                _this.forceUpdate();
            });
        });
    };
    DialogMonitorManagerSettingTab.prototype.onSetSettingsOfMonitor = function () {
        var _this = this;
        this.updateSettings();
        var GUID = this.showProgress('Please wait...');
        this.setSettingsOfMonitor(function (result) {
            _this.getStateMonitor(function (state) {
                _this.state = state !== null ? state : { active: false, port: '' };
                controller_1.popupController.close(GUID);
                _this.forceUpdate();
            });
        }, {
            maxFilesCount: this.maxFilesCount,
            maxFileSizeMB: this.maxFileSizeMB,
            port: this.port,
            portSettings: this.portSettings
        });
    };
    DialogMonitorManagerSettingTab.prototype.onStopMonitor = function () {
        var _this = this;
        this.updateSettings();
        this.port = '';
        var GUID = this.showProgress('Please wait...');
        this.setSettingsOfMonitor(function (result) {
            _this.getStateMonitor(function (state) {
                _this.state = state !== null ? state : { active: false, port: '' };
                controller_1.popupController.close(GUID);
                _this.forceUpdate();
            });
        }, {
            maxFilesCount: this.maxFilesCount,
            maxFileSizeMB: this.maxFileSizeMB,
            port: this.port,
            portSettings: this.portSettings
        });
    };
    DialogMonitorManagerSettingTab.prototype.updateSettings = function () {
        var _this = this;
        this.maxFilesCount = parseInt(this._maxFilesCount.getValue(), 10);
        this.maxFileSizeMB = parseInt(this._maxFileSizeMB.getValue(), 10);
        this.port = this._port.getValue();
        var validSettings = true;
        if (this.portSettings === null || typeof this.portSettings !== 'object') {
            validSettings = false;
        }
        else {
            var defaults_1 = new defaults_settings_1.DefaultsPortSettings();
            Object.keys(defaults_1).forEach(function (key) {
                if (_this.portSettings[key] === void 0 || typeof _this.portSettings[key] !== typeof defaults_1[key]) {
                    validSettings = false;
                }
            });
        }
        !validSettings && (this.portSettings = new defaults_settings_1.DefaultsPortSettings());
    };
    DialogMonitorManagerSettingTab.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    return DialogMonitorManagerSettingTab;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogMonitorManagerSettingTab.prototype, "maxFileSizeMB", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogMonitorManagerSettingTab.prototype, "maxFilesCount", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogMonitorManagerSettingTab.prototype, "port", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogMonitorManagerSettingTab.prototype, "portSettings", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], DialogMonitorManagerSettingTab.prototype, "ports", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogMonitorManagerSettingTab.prototype, "state", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerSettingTab.prototype, "stopAndClearMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerSettingTab.prototype, "restartMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerSettingTab.prototype, "setSettingsOfMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerSettingTab.prototype, "clearLogsOfMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerSettingTab.prototype, "getStateMonitor", void 0);
__decorate([
    core_1.ViewChild('_maxFileSizeMB'),
    __metadata("design:type", component_1.CommonInput)
], DialogMonitorManagerSettingTab.prototype, "_maxFileSizeMB", void 0);
__decorate([
    core_1.ViewChild('_maxFilesCount'),
    __metadata("design:type", component_1.CommonInput)
], DialogMonitorManagerSettingTab.prototype, "_maxFilesCount", void 0);
__decorate([
    core_1.ViewChild('_port'),
    __metadata("design:type", component_4.SimpleDropDownList)
], DialogMonitorManagerSettingTab.prototype, "_port", void 0);
DialogMonitorManagerSettingTab = __decorate([
    core_1.Component({
        selector: 'dialog-monitor-manager-settings-tab',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], DialogMonitorManagerSettingTab);
exports.DialogMonitorManagerSettingTab = DialogMonitorManagerSettingTab;
//# sourceMappingURL=component.js.map
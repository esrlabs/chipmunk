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
var component_1 = require("./settings/component");
var component_2 = require("./logs/component");
var DialogMonitorManager = (function () {
    function DialogMonitorManager(componentFactoryResolver) {
        this.componentFactoryResolver = componentFactoryResolver;
        this.timeoutOnError = 5000;
        this.timeoutOnClose = 5000;
        this.maxFileSizeMB = 100;
        this.maxFilesCount = 10;
        this.port = '';
        this.command = '';
        this.path = '';
        this.portSettings = {};
        this.ports = [];
        this.state = null;
        this.files = [];
        this.register = {};
        this.getFileContent = null;
        this.getAllFilesContent = null;
        this.getMatches = null;
        this.stopAndClearMonitor = null;
        this.restartMonitor = null;
        this.setSettingsOfMonitor = null;
        this.clearLogsOfMonitor = null;
        this.getStateMonitor = null;
        this.getFilesInfo = null;
        this.tabs = [];
        this.onResize = new core_1.EventEmitter();
    }
    DialogMonitorManager.prototype.ngOnInit = function () {
        this.initTabs();
    };
    DialogMonitorManager.prototype.initTabs = function () {
        var emitterResultsSelect = new core_1.EventEmitter(), emitterRequestsSelect = new core_1.EventEmitter(), emitterResultsDeselect = new core_1.EventEmitter(), emitterRequestsDeselect = new core_1.EventEmitter(), emitterResultsResize = new core_1.EventEmitter(), emitterRequestsResize = new core_1.EventEmitter();
        this.tabs.push({
            id: Symbol(),
            label: 'Settings',
            onSelect: emitterResultsSelect,
            onDeselect: emitterResultsDeselect,
            onResize: emitterResultsResize,
            factory: this.componentFactoryResolver.resolveComponentFactory(component_1.DialogMonitorManagerSettingTab),
            params: {
                ports: this.ports,
                timeoutOnError: this.timeoutOnError,
                timeoutOnClose: this.timeoutOnClose,
                maxFileSizeMB: this.maxFileSizeMB,
                maxFilesCount: this.maxFilesCount,
                portSettings: this.portSettings,
                port: this.port,
                command: this.command,
                path: this.path,
                state: this.state,
                onSelect: emitterResultsSelect,
                onDeselect: emitterResultsDeselect,
                onResize: emitterResultsResize,
                stopAndClearMonitor: this.stopAndClearMonitor,
                restartMonitor: this.restartMonitor,
                setSettingsOfMonitor: this.setSettingsOfMonitor,
                clearLogsOfMonitor: this.clearLogsOfMonitor,
                getStateMonitor: this.getStateMonitor
            },
            update: null,
            active: true
        });
        this.tabs.push({
            id: Symbol(),
            label: 'Logs',
            onSelect: emitterRequestsSelect,
            onDeselect: emitterRequestsDeselect,
            onResize: emitterResultsResize,
            factory: this.componentFactoryResolver.resolveComponentFactory(component_2.DialogMonitorManagerLogsTab),
            params: {
                files: this.files,
                register: this.register,
                getFileContent: this.getFileContent,
                getAllFilesContent: this.getAllFilesContent,
                getMatches: this.getMatches,
                getFilesInfo: this.getFilesInfo,
                onSelect: emitterRequestsSelect,
                onDeselect: emitterRequestsDeselect,
                onResize: emitterResultsResize
            },
            update: null,
            active: false
        });
    };
    return DialogMonitorManager;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogMonitorManager.prototype, "timeoutOnError", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogMonitorManager.prototype, "timeoutOnClose", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogMonitorManager.prototype, "maxFileSizeMB", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], DialogMonitorManager.prototype, "maxFilesCount", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogMonitorManager.prototype, "port", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogMonitorManager.prototype, "command", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], DialogMonitorManager.prototype, "path", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogMonitorManager.prototype, "portSettings", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], DialogMonitorManager.prototype, "ports", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogMonitorManager.prototype, "state", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], DialogMonitorManager.prototype, "files", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogMonitorManager.prototype, "register", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "getFileContent", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "getAllFilesContent", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "getMatches", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "stopAndClearMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "restartMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "setSettingsOfMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "clearLogsOfMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "getStateMonitor", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManager.prototype, "getFilesInfo", void 0);
DialogMonitorManager = __decorate([
    core_1.Component({
        selector: 'dialog-monitor-manager',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver])
], DialogMonitorManager);
exports.DialogMonitorManager = DialogMonitorManager;
//# sourceMappingURL=component.js.map
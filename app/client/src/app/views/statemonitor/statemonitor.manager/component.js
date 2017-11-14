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
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_config_1 = require("../../../core/modules/controller.config");
var controller_localsettings_1 = require("../../../core/modules/controller.localsettings");
var controller_1 = require("../../../core/components/common/popup/controller");
var component_1 = require("../../../core/components/common/dialogs/statemonitor.indicate.edit/component");
var component_2 = require("../../../core/components/common/dialogs/statemonitor.edit/component");
var class_tab_controller_1 = require("../../../core/components/common/tabs/tab/class.tab.controller");
var controller_2 = require("../../../core/components/common/fileloader/controller");
var component_3 = require("../../../core/components/common/progressbar.circle/component");
var component_4 = require("../../../core/components/common/dialogs/dialog-message/component");
var SETTINGS = {
    LIST_KEY: 'LIST_KEY'
};
var ViewControllerStateMonitorManager = (function (_super) {
    __extends(ViewControllerStateMonitorManager, _super);
    function ViewControllerStateMonitorManager(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.sanitizer = sanitizer;
        _this.indicates = [];
        _this.exportdata = {
            url: null,
            filename: ''
        };
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        [].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _this.addIndicate = _this.addIndicate.bind(_this);
        _this.onEditAsJSON = _this.onEditAsJSON.bind(_this);
        _this.onExport = _this.onExport.bind(_this);
        _this.onImport = _this.onImport.bind(_this);
        _this.onRemoveAll = _this.onRemoveAll.bind(_this);
        _this.loadIndicates();
        return _this;
    }
    ViewControllerStateMonitorManager.prototype.ngOnInit = function () {
    };
    ViewControllerStateMonitorManager.prototype.ngOnDestroy = function () {
        var _this = this;
        [].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ViewControllerStateMonitorManager.prototype.ngAfterViewChecked = function () {
        if (this.exportdata.url !== null && this.exportURLNode !== null) {
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url = null;
            this.exportdata.filename = '';
        }
    };
    ViewControllerStateMonitorManager.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerStateMonitorManager.prototype.loadIndicates = function () {
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null
            && settings[controller_localsettings_1.KEYs.view_statemonitor] !== void 0
            && settings[controller_localsettings_1.KEYs.view_statemonitor] !== null
            && typeof settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY] === 'object'
            && settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY] !== null) {
            this.indicates = Object.keys(settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY]).map(function (id) {
                return Object.assign({}, settings[controller_localsettings_1.KEYs.view_statemonitor][SETTINGS.LIST_KEY][id]);
            });
        }
        else {
            this.indicates = Object.keys(controller_config_1.configuration.sets.VIEW_STATEMONITOR.IndicatesRules).map(function (id) {
                return Object.assign({}, controller_config_1.configuration.sets.VIEW_STATEMONITOR.IndicatesRules[id]);
            });
        }
    };
    ViewControllerStateMonitorManager.prototype.saveIndicates = function () {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.view_statemonitor] = (_b = {},
                _b[SETTINGS.LIST_KEY] = this.indicates,
                _b),
            _a));
        var _a, _b;
    };
    ViewControllerStateMonitorManager.prototype.addIndicate = function () {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.DialogStatemonitorIndicateEdit,
                params: {
                    name: '',
                    callback: function (name) {
                        if (typeof name === 'string' && name.trim() !== '') {
                            this.indicates.push({
                                name: name,
                                icon: '',
                                css: '',
                                label: name,
                                description: '',
                                states: []
                            });
                            this.forceUpdate();
                            controller_1.popupController.close(popup);
                        }
                    }.bind(this)
                }
            },
            title: _('Add New Indicate'),
            settings: {
                move: true,
                resize: false,
                width: '40rem',
                height: '7.5rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerStateMonitorManager.prototype.onIndicateRemove = function (index) {
        this.indicates[index] !== void 0 && this.indicates.splice(index, 1);
        this.saveIndicates();
    };
    ViewControllerStateMonitorManager.prototype.onIndicateUpdate = function (index, indicate) {
        if (this.indicates[index] !== void 0) {
            this.indicates[index] = indicate;
            this.saveIndicates();
        }
    };
    ViewControllerStateMonitorManager.prototype.onEditAsJSON = function () {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.DialogStatemonitorEditJSON,
                params: {
                    json: JSON.stringify(this.indicates),
                    callback: function (json) {
                        this.indicates = JSON.parse(json);
                        this.saveIndicates();
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Edit monitor rules'),
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
            GUID: popup
        });
    };
    ViewControllerStateMonitorManager.prototype.showErrorMessage = function (title, message) {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_4.DialogMessage,
                params: {
                    message: message,
                    buttons: [
                        { caption: 'OK', handle: function () { controller_1.popupController.close(popup); } },
                    ]
                }
            },
            title: title,
            settings: {
                move: true,
                resize: true,
                width: '30rem',
                height: '15rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerStateMonitorManager.prototype.onRemoveAll = function () {
        var _this = this;
        var GUID = Symbol();
        this.indicates.length > 0 && controller_1.popupController.open({
            content: {
                factory: null,
                component: component_4.DialogMessage,
                params: {
                    message: 'Are you sure that you want to remove indicates? Export it before to have a possibility to restore it after.',
                    buttons: [
                        { caption: 'Export it and remove', handle: function () { _this.onExport(); _this.removeAll(); controller_1.popupController.close(GUID); } },
                        { caption: 'Just remove it', handle: function () { _this.removeAll(); controller_1.popupController.close(GUID); } },
                        { caption: 'Leave it', handle: function () { controller_1.popupController.close(GUID); } },
                    ]
                }
            },
            title: _('Confirmation'),
            settings: {
                move: true,
                resize: true,
                width: '30rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    ViewControllerStateMonitorManager.prototype.removeAll = function () {
        this.indicates = [];
        this.saveIndicates();
    };
    ViewControllerStateMonitorManager.prototype.validateImportData = function (smth) {
        var result = {
            result: true,
            msg: ''
        }, _indicate = {
            name: 'string'
        }, _state = {
            icon: 'string',
            hook: 'string',
            label: 'string',
            defaults: 'boolean'
        };
        if (smth instanceof Array) {
            smth.forEach(function (indicate) {
                if (result.result && indicate !== null && typeof indicate === 'object') {
                    Object.keys(_indicate).forEach(function (key) {
                        if ((typeof indicate[key] !== _indicate[key])) {
                            result.msg = "indicate's property [" + key + "] should have format [" + _indicate[key] + "]";
                            result.result = false;
                        }
                    });
                    if (result && indicate.states instanceof Array) {
                        indicate.states.forEach(function (state) {
                            if (result && state !== null && typeof state === 'object') {
                                Object.keys(_state).forEach(function (key) {
                                    if ((typeof state[key] !== _state[key])) {
                                        result.msg = "state's property [" + key + "] should have format [" + _state[key] + "]";
                                        result.result = false;
                                    }
                                });
                            }
                            else {
                                result.msg === '' && (result.msg = "states should have format [Array]");
                                result.result = false;
                            }
                        });
                    }
                    else {
                        result.msg === '' && (result.msg = "indicate's property [states] should have format [Array]");
                        result.result = false;
                    }
                }
                else {
                    result.msg === '' && (result.msg = "indicate should be [Object]");
                    result.result = false;
                }
            });
        }
        else {
            result.msg === '' && (result.msg = "collection of indicates should be [Array]");
            result.result = false;
        }
        return result;
    };
    ViewControllerStateMonitorManager.prototype.onImport = function () {
        var _this = this;
        var GUID = Symbol();
        controller_2.fileLoaderController.open(Symbol(), {
            load: function (data, files) {
                controller_1.popupController.close(GUID);
                if (typeof data === 'string') {
                    try {
                        var result = JSON.parse(data);
                        if (_this.validateImportData(result).result) {
                            _this.indicates = result;
                            _this.saveIndicates();
                        }
                        else {
                            _this.showErrorMessage('Wrong format', 'Basically JSON format is okay. But we\'ve tried to parse content and didn\'t find data, which can be used for indicates. Or imported data has some incorrect /corrupted format. More info: ' + _this.validateImportData(result).msg);
                        }
                    }
                    catch (e) {
                        _this.showErrorMessage('Wrong JSON format', 'Cannot parse content of file. Expected format is JSON.');
                    }
                }
            },
            error: function (event) {
            },
            reading: function (file) {
                controller_1.popupController.open({
                    content: {
                        factory: null,
                        component: component_3.ProgressBarCircle,
                        params: {}
                    },
                    title: 'Please, wait...',
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
            }
        });
    };
    ViewControllerStateMonitorManager.prototype.onExport = function () {
        if (Object.keys(this.indicates).length > 0) {
            var str = JSON.stringify(this.indicates), blob = new Blob([str], { type: 'text/plain' }), url = URL.createObjectURL(blob);
            this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
            this.exportdata.filename = 'export_chats_sets' + (new Date()).getTime() + '.json';
        }
    };
    return ViewControllerStateMonitorManager;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.ViewChild('exporturl', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ViewControllerStateMonitorManager.prototype, "exportURLNode", void 0);
ViewControllerStateMonitorManager = __decorate([
    core_1.Component({
        selector: 'view-controller-state-monitor-manager',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], ViewControllerStateMonitorManager);
exports.ViewControllerStateMonitorManager = ViewControllerStateMonitorManager;
//# sourceMappingURL=component.js.map
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
var controller_data_parsers_tracker_manager_1 = require("../../../core/modules/parsers/controller.data.parsers.tracker.manager");
var class_tab_controller_1 = require("../class.tab.controller");
var controller_1 = require("../../../core/components/common/popup/controller");
var component_1 = require("../../../core/components/common/dialogs/charts.edit.rules.hooks/component");
var component_2 = require("../../../core/components/common/dialogs/charts.edit.rules.segments/component");
var component_3 = require("../../../core/components/common/dialogs/charts.edit.type/component");
var component_4 = require("../../../core/components/common/dialogs/dialog-message/component");
var component_5 = require("../../../core/components/common/dialogs/image/component");
var controller_2 = require("../../../core/components/common/fileloader/controller");
var component_6 = require("../../../core/components/common/progressbar.circle/component");
var CHART_TYPES = {
    hooks: 'hooks',
    segments: 'segments'
};
var CHART_SCHEMES = {
    hooks: 'app/images/view.charts/charts.hooks.png',
    segments: 'app/images/view.charts/charts.segments.png'
};
var ViewControllerTabChartManager = (function (_super) {
    __extends(ViewControllerTabChartManager, _super);
    function ViewControllerTabChartManager(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.sanitizer = sanitizer;
        _this.manager = new controller_data_parsers_tracker_manager_1.Manager();
        _this.sets = null;
        _this.outdata = [];
        _this.exportdata = {
            url: null,
            filename: ''
        };
        _this.onTabSelected = _this.onTabSelected.bind(_this);
        _this.onTabDeselected = _this.onTabDeselected.bind(_this);
        _this.onResizeHandle = _this.onResizeHandle.bind(_this);
        _this.onExportSets = _this.onExportSets.bind(_this);
        _this.onImportSets = _this.onImportSets.bind(_this);
        [controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_ADD_NEW_CHART,
            controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        //Load available sets
        _this.loadSets();
        return _this;
    }
    ViewControllerTabChartManager.prototype.ngOnInit = function () {
        //this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.onSelect.subscribe(this.onTabSelected);
        this.onDeselect.subscribe(this.onTabDeselected);
        this.onResize.subscribe(this.onResizeHandle);
    };
    ViewControllerTabChartManager.prototype.ngAfterViewChecked = function () {
        if (this.exportdata.url !== null && this.exportURLNode !== null) {
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url = null;
            this.exportdata.filename = '';
        }
    };
    ViewControllerTabChartManager.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_ADD_NEW_CHART,
            controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerTabChartManager.prototype.onTabSelected = function () {
        this.forceUpdate();
    };
    ViewControllerTabChartManager.prototype.onTabDeselected = function () {
    };
    ViewControllerTabChartManager.prototype.onResizeHandle = function () {
        this.forceUpdate();
    };
    ViewControllerTabChartManager.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerTabChartManager.prototype.loadSets = function () {
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
        this.initializeSetsParameters();
    };
    ViewControllerTabChartManager.prototype.initializeSetsParameters = function () {
        var _this = this;
        this.outdata = Object.keys(this.sets).map(function (GUID) {
            return {
                GUID: GUID,
                remove: _this.onRemoveSet.bind(_this, GUID)
            };
        });
    };
    ViewControllerTabChartManager.prototype.onRemoveSet = function (GUID) {
        var _this = this;
        if (this.sets[GUID] !== void 0) {
            var popup_1 = Symbol();
            controller_1.popupController.open({
                content: {
                    factory: null,
                    component: component_4.DialogMessage,
                    params: {
                        message: 'Are you sure that you want to remove this sets for charts? It will be impossible to restore.',
                        buttons: [
                            { caption: 'Yes, remove it', handle: function () { _this.manager.remove(GUID); controller_1.popupController.close(popup_1); } },
                            { caption: 'No, leave it', handle: function () { controller_1.popupController.close(popup_1); } },
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
                GUID: popup_1
            });
        }
    };
    ViewControllerTabChartManager.prototype.popupSelectType = function () {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_3.ChartEditTypeDialog,
                params: {
                    types: [
                        {
                            id: CHART_TYPES.segments,
                            name: 'By segments',
                            description: 'This type of parser better to use with values, which has very similar format.',
                            scheme: CHART_SCHEMES.segments
                        },
                        {
                            id: CHART_TYPES.hooks,
                            name: 'By hooks',
                            description: 'This type of parser better to use with values without any common format or structure.',
                            scheme: CHART_SCHEMES.hooks
                        }
                    ],
                    onSelect: function (type) {
                        switch (type) {
                            case CHART_TYPES.segments:
                                this.popupCreateNewOfType(component_2.ChartEditRulesSegmentsDialog, this.popupShowScheme.bind(this, CHART_SCHEMES.segments));
                                break;
                            case CHART_TYPES.hooks:
                                this.popupCreateNewOfType(component_1.ChartEditRulesHooksDialog, this.popupShowScheme.bind(this, CHART_SCHEMES.hooks));
                                break;
                        }
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Select type of chart\'s data parser.'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '16rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerTabChartManager.prototype.popupCreateNewOfType = function (dialog, openScheme) {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: dialog,
                params: {
                    GUID: null,
                    callback: function (set) {
                        this.manager.add(set);
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('New Chart'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '70%',
                close: true,
                addCloseHandle: false,
                css: ''
            },
            buttons: [],
            titlebuttons: [
                {
                    icon: 'fa-question-circle-o',
                    hint: 'More about this type of data parser',
                    handle: openScheme
                }
            ],
            GUID: popup
        });
    };
    ViewControllerTabChartManager.prototype.popupShowScheme = function (url) {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_5.ImageDialog,
                params: {
                    url: url
                }
            },
            title: _('Scheme of type'),
            settings: {
                move: true,
                resize: true,
                width: '95%',
                height: '95%',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerTabChartManager.prototype.onCHART_VIEW_ADD_NEW_CHART = function () {
        this.popupSelectType();
    };
    ViewControllerTabChartManager.prototype.onCHART_VIEW_CHARTS_UPDATED = function () {
        this.loadSets();
        this.forceUpdate();
    };
    ViewControllerTabChartManager.prototype.showErrorMessage = function (title, message) {
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
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerTabChartManager.prototype.validateImportData = function (data) {
        if (typeof data === 'object' && data !== null) {
            var spaces_1 = {
                common: ['name', 'lineColor', 'textColor', 'active', 'indexes'],
                segments: ['segments', 'values', 'clearing'],
                hooks: ['tests']
            }, result_1 = true;
            Object.keys(data).forEach(function (ID) {
                var results = {
                    common: true,
                    segments: true,
                    hooks: true
                };
                ['common', 'segments', 'hooks'].forEach(function (segment) {
                    if (results[segment]) {
                        spaces_1[segment].forEach(function (field) {
                            if (typeof data[ID] === 'object' && data[ID] !== null) {
                                data[ID][field] === void 0 && (results[segment] = false);
                            }
                            else {
                                results[segment] = false;
                            }
                        });
                    }
                });
                if (!results.common) {
                    result_1 = false;
                }
                if (!results.segments && !results.hooks) {
                    result_1 = false;
                }
            });
            return result_1;
        }
        return false;
    };
    ViewControllerTabChartManager.prototype.onImportSets = function () {
        var _this = this;
        var GUID = Symbol();
        controller_2.fileLoaderController.open(Symbol(), {
            load: function (data, files) {
                controller_1.popupController.close(GUID);
                if (typeof data === 'string') {
                    try {
                        var result = JSON.parse(data);
                        if (_this.validateImportData(result)) {
                            _this.sets = result;
                            _this.manager.save(_this.sets, true);
                        }
                        else {
                            _this.showErrorMessage('Wrong format', 'Basically JSON format is okay. But we\'ve tried to parse content and didn\'t find data, which can be used for charts. Or impoerted data has some incorrect /corrupted format.');
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
                        component: component_6.ProgressBarCircle,
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
    ViewControllerTabChartManager.prototype.onExportSets = function () {
        if (Object.keys(this.sets).length > 0) {
            var str = JSON.stringify(this.sets), blob = new Blob([str], { type: 'text/plain' }), url = URL.createObjectURL(blob);
            this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
            this.exportdata.filename = 'export_chats_sets' + (new Date()).getTime() + '.json';
        }
    };
    return ViewControllerTabChartManager;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.ViewChild('exporturl', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ViewControllerTabChartManager.prototype, "exportURLNode", void 0);
ViewControllerTabChartManager = __decorate([
    core_1.Component({
        selector: 'view-controller-chart-manager',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], ViewControllerTabChartManager);
exports.ViewControllerTabChartManager = ViewControllerTabChartManager;
//# sourceMappingURL=component.js.map
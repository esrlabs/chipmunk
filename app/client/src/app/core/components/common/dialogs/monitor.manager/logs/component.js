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
var component_2 = require("../../../checkboxes/simple/component");
var controller_1 = require("../../../../common/popup/controller");
var component_3 = require("../../../../common/progressbar.circle/component");
var controller_config_1 = require("../../../../../modules/controller.config");
var controller_events_1 = require("../../../../../modules/controller.events");
var class_tab_controller_1 = require("../../../../common/tabs/tab/class.tab.controller");
var component_4 = require("../../../buttons/flat-text/component");
var platform_browser_1 = require("@angular/platform-browser");
var tools_regexp_1 = require("../../../../../modules/tools.regexp");
var component_5 = require("../../../text/simple/component");
var ALL_FILES = Symbol();
var MAX_LINE_FOR_REQUEST = 100;
var MAX_FILE_SIZE_TO_OPEN = 50 * 1024 * 1024;
var DialogMonitorManagerLogsTab = (function (_super) {
    __extends(DialogMonitorManagerLogsTab, _super);
    function DialogMonitorManagerLogsTab(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.sanitizer = sanitizer;
        _this.files = [];
        _this.register = {};
        _this.getFileContent = null;
        _this.getAllFilesContent = null;
        _this.getMatches = null;
        _this.getFilesInfo = null;
        _this.defaultColumns = ['Name', 'Started', 'Updated', 'Size'];
        _this.columns = [];
        _this.rows = [];
        _this.selected = -1;
        _this.cache = {};
        _this.exportdata = {
            url: null,
            filename: ''
        };
        _this.searchResults = [];
        _this.onDownload = _this.onDownload.bind(_this);
        _this.onOpen = _this.onOpen.bind(_this);
        _this.onOpenAll = _this.onOpenAll.bind(_this);
        _this.onDownloadAll = _this.onDownloadAll.bind(_this);
        _this.onTabSelected = _this.onTabSelected.bind(_this);
        _this.onTabDeselected = _this.onTabDeselected.bind(_this);
        return _this;
    }
    DialogMonitorManagerLogsTab.prototype.ngOnInit = function () {
        this.onSelect.subscribe(this.onTabSelected);
        this.onDeselect.subscribe(this.onTabDeselected);
    };
    DialogMonitorManagerLogsTab.prototype.ngOnDestroy = function () {
        this.onSelect.unsubscribe();
        this.onDeselect.unsubscribe();
    };
    DialogMonitorManagerLogsTab.prototype.ngAfterContentInit = function () {
        this.updateRows();
    };
    DialogMonitorManagerLogsTab.prototype.ngAfterViewChecked = function () {
        if (this.exportdata.url !== null && this.exportURLNode !== null) {
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url = null;
            this.exportdata.filename = '';
        }
    };
    DialogMonitorManagerLogsTab.prototype.updateRows = function () {
        var _this = this;
        var byFiles = {};
        this.rows = [];
        this.columns = [];
        (_a = this.columns).push.apply(_a, this.defaultColumns);
        if (this.searchResults.length > 0) {
            (_b = this.columns).push.apply(_b, this.searchResults[0].results.map(function (results) {
                return results.request;
            }));
            this.searchResults.forEach(function (results) {
                byFiles[results.file] = results.results;
            });
        }
        if (this.files instanceof Array && typeof this.register === 'object' && this.register !== null) {
            this.files.forEach(function (file) {
                if (_this.parseRegisterEntry(_this.register[file])) {
                    var row = [
                        file,
                        _this.register[file].opened !== -1 ? _this.getDate(_this.register[file].opened) : 'no open date',
                        _this.register[file].closed !== -1 ? _this.getDate(_this.register[file].closed) : 'not updated yet',
                        (_this.register[file].size / 1024 / 1024).toFixed(2) + ' MB'
                    ];
                    if (byFiles[file] !== void 0) {
                        row.push.apply(row, byFiles[file].map(function (results) {
                            return results.count;
                        }));
                    }
                    _this.rows.push(row);
                }
            });
        }
        var _a, _b;
    };
    DialogMonitorManagerLogsTab.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    DialogMonitorManagerLogsTab.prototype.parseRegisterEntry = function (entry) {
        var result = true;
        if (typeof entry === 'object' && entry !== null) {
            entry.opened === void 0 && (result = false);
            entry.closed === void 0 && (result = false);
        }
        else {
            result = false;
        }
        return result;
    };
    DialogMonitorManagerLogsTab.prototype.getDate = function (timestamp) {
        function fillDigits(d, c) {
            var res = d + '';
            return (res.length < c ? '0'.repeat(c - res.length) : '') + res;
        }
        ;
        var result = '';
        var date = new Date(timestamp);
        return fillDigits(date.getDate(), 2) + "." + fillDigits(date.getMonth() + 1, 2) + "." + fillDigits(date.getFullYear(), 4) + " " + fillDigits(date.getHours(), 2) + ":" + fillDigits(date.getMinutes(), 2) + ":" + fillDigits(date.getSeconds(), 2) + ":" + fillDigits(date.getMilliseconds(), 3);
    };
    DialogMonitorManagerLogsTab.prototype.onTabSelected = function () {
        var _this = this;
        var GUID = this.showProgress('Please wait...');
        this.getFilesInfo(function (info) {
            controller_1.popupController.close(GUID);
            info = info !== null ? info : { list: [], register: {} };
            _this.files = info.list;
            _this.register = info.register;
            _this.updateRows();
        });
    };
    DialogMonitorManagerLogsTab.prototype.onTabDeselected = function () {
    };
    DialogMonitorManagerLogsTab.prototype._downloadAllFiles = function (callback) {
        var _this = this;
        if (this.cache[ALL_FILES] !== void 0) {
            return callback(this.cache[ALL_FILES]);
        }
        var GUID = this.showProgress("Please wait...");
        this.getAllFilesContent(function (text) {
            controller_1.popupController.close(GUID);
            if (typeof text !== 'string') {
                return callback(null);
            }
            _this.cache[ALL_FILES] = text;
            callback(text);
        });
    };
    DialogMonitorManagerLogsTab.prototype.onOpenAll = function () {
        var _this = this;
        this._downloadAllFiles(function (content) {
            if (content !== null) {
                if (content.length > MAX_FILE_SIZE_TO_OPEN) {
                    return _this.showMessage('Too big file', "Unfortunately current version of logviewer cannot open this file. It's too big. Size of file is: " + Math.round(content.length / 1024 / 1024) + " Mb. Maximum supported file size is: " + MAX_FILE_SIZE_TO_OPEN + " Mb.");
                }
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, 'Compilation from all logs files');
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, content);
            }
        });
    };
    DialogMonitorManagerLogsTab.prototype.onDownloadAll = function () {
        var _this = this;
        this._downloadAllFiles(function (content) {
            if (content !== null) {
                _this.downloadFile('export_' + (new Date()).getTime() + '.logs', content);
            }
        });
    };
    DialogMonitorManagerLogsTab.prototype._downloadSelectedFile = function (callback) {
        var _this = this;
        if (!~this.selected || this.files[this.selected] === void 0) {
            return callback(null, null);
        }
        var file = this.files[this.selected];
        if (this.cache[file] !== void 0) {
            return callback(file, this.cache[file]);
        }
        var GUID = this.showProgress("Please wait...");
        this.getFileContent(file, function (text) {
            controller_1.popupController.close(GUID);
            if (typeof text !== 'string') {
                return callback(null, null);
            }
            _this.cache[file] = text;
            callback(file, text);
        });
    };
    DialogMonitorManagerLogsTab.prototype.onDownload = function () {
        var _this = this;
        this._downloadSelectedFile(function (file, content) {
            if (file !== null && content !== null) {
                _this.downloadFile(file, content);
            }
        });
    };
    DialogMonitorManagerLogsTab.prototype.onOpen = function () {
        this._downloadSelectedFile(function (file, content) {
            if (file !== null && content !== null) {
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, file);
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, content);
            }
        });
    };
    DialogMonitorManagerLogsTab.prototype.onSelectFile = function (index) {
        this.selected = index;
        if (this.selected !== -1) {
            this._buttonDownload.enable();
            this._buttonOpen.enable();
        }
        else {
            this._buttonDownload.disable();
            this._buttonOpen.disable();
        }
        this.forceUpdate();
    };
    DialogMonitorManagerLogsTab.prototype.onSearchRequest = function () {
        var _this = this;
        function addMarkers(str, isReg, request) {
            var reg = new RegExp(isReg ? request : tools_regexp_1.serializeStringForReg(request), 'gi');
            var matches = str.match(reg);
            if (matches instanceof Array) {
                matches.forEach(function (match) {
                    str = str.replace(match, "<span class=\"match\">" + match + "</span>");
                });
            }
            return this.sanitizer.bypassSecurityTrustHtml(str);
        }
        ;
        var request = this._search_request.getValue();
        var reg = this._search_reg.getValue();
        if (request.trim() !== '' && this.files.length > 0) {
            request = request.split(';').filter(function (request) {
                return request.trim() !== '';
            });
            var GUID_1 = this.showProgress("Please wait...");
            this.getMatches(reg, request, function (result) {
                controller_1.popupController.close(GUID_1);
                if (result === null) {
                    return false;
                }
                _this.searchResults = [];
                Object.keys(result).forEach(function (file) {
                    var requests = result[file];
                    var searchResults = {
                        file: file,
                        results: Object.keys(requests).map(function (request) {
                            !(requests[request] instanceof Array) && (requests[request] = []);
                            return {
                                request: request,
                                matches: requests[request].map(function (match, index) {
                                    return index < MAX_LINE_FOR_REQUEST ? addMarkers.call(_this, typeof match === 'string' ? match : '', reg, request) : false;
                                }).filter(function (str) {
                                    return str !== false;
                                }),
                                count: requests[request].length
                            };
                        })
                    };
                    _this.searchResults.push(searchResults);
                });
                _this.updateRows();
                _this.forceUpdate();
            });
        }
    };
    DialogMonitorManagerLogsTab.prototype.showProgress = function (caption) {
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
    DialogMonitorManagerLogsTab.prototype.showMessage = function (title, message) {
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_5.SimpleText,
                params: {
                    text: message
                }
            },
            title: title,
            settings: {
                move: true,
                resize: true,
                width: '20rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: Symbol()
        });
    };
    DialogMonitorManagerLogsTab.prototype.downloadFile = function (file, content) {
        var blob = new Blob([content], { type: 'text/plain' }), url = URL.createObjectURL(blob);
        this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename = file;
        this.forceUpdate();
    };
    return DialogMonitorManagerLogsTab;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], DialogMonitorManagerLogsTab.prototype, "files", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], DialogMonitorManagerLogsTab.prototype, "register", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerLogsTab.prototype, "getFileContent", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerLogsTab.prototype, "getAllFilesContent", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerLogsTab.prototype, "getMatches", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], DialogMonitorManagerLogsTab.prototype, "getFilesInfo", void 0);
__decorate([
    core_1.ViewChild('_buttonDownload'),
    __metadata("design:type", component_4.ButtonFlatText)
], DialogMonitorManagerLogsTab.prototype, "_buttonDownload", void 0);
__decorate([
    core_1.ViewChild('_buttonOpen'),
    __metadata("design:type", component_4.ButtonFlatText)
], DialogMonitorManagerLogsTab.prototype, "_buttonOpen", void 0);
__decorate([
    core_1.ViewChild('_search_request'),
    __metadata("design:type", component_1.CommonInput)
], DialogMonitorManagerLogsTab.prototype, "_search_request", void 0);
__decorate([
    core_1.ViewChild('_search_reg'),
    __metadata("design:type", component_2.SimpleCheckbox)
], DialogMonitorManagerLogsTab.prototype, "_search_reg", void 0);
__decorate([
    core_1.ViewChild('exporturl', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], DialogMonitorManagerLogsTab.prototype, "exportURLNode", void 0);
DialogMonitorManagerLogsTab = __decorate([
    core_1.Component({
        selector: 'dialog-monitor-manager-logs-tab',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], DialogMonitorManagerLogsTab);
exports.DialogMonitorManagerLogsTab = DialogMonitorManagerLogsTab;
//# sourceMappingURL=component.js.map
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
var platform_browser_1 = require("@angular/platform-browser");
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_config_1 = require("../../../core/modules/controller.config");
var tools_ansireader_1 = require("../../../core/modules/tools.ansireader");
var tools_htmlserialize_1 = require("../../../core/modules/tools.htmlserialize");
var tools_regexp_1 = require("../../../core/modules/tools.regexp");
var MARKERS = {
    MATCH: '\uAA86!\uAA87',
    MARKER_LEFT: '\uAA88',
    MARKER_RIGHT: '\uAA89'
};
var INDEX_MARKERS = {
    MARKER: '\u0001'
};
var MARKERS_SELECTION_MODE = {
    WORDS: 'words',
    LINES: 'lines'
};
var ViewControllerListItem = (function () {
    function ViewControllerListItem(changeDetectorRef, sanitizer) {
        this.changeDetectorRef = changeDetectorRef;
        this.sanitizer = sanitizer;
        this.GUID = '';
        this.val = '';
        this.visibility = true;
        this.filtered = false;
        this.match = '';
        this.matchReg = true;
        this.index = 0;
        this.total_rows = 0;
        this.selection = false;
        this.bookmarked = false;
        this.markersHash = '';
        this.markerSelectMode = '';
        this.regsCache = {};
        this.markers = []; //Do not bind this <Marker> type, because markers view can be removed
        this.highlight = {
            backgroundColor: '',
            foregroundColor: ''
        };
        this.selected = new core_1.EventEmitter();
        this.bookmark = new core_1.EventEmitter();
        this.__index = '';
        this.html = null;
        this.safeHTML = null;
        this._markersHash = '';
        this._match = '';
        this._matchReg = true;
        this._total_rows = -1;
        this._highlight = {
            backgroundColor: '',
            foregroundColor: ''
        };
        this.changeDetectorRef = changeDetectorRef;
        this.sanitizer = sanitizer;
    }
    ViewControllerListItem.prototype.ngOnDestroy = function () {
    };
    ViewControllerListItem.prototype.updateFilledIndex = function () {
        var total = this.total_rows.toString(), current = this.index.toString();
        this.__index = INDEX_MARKERS.MARKER + (total.length - current.length > 0 ? ('0'.repeat(total.length - current.length)) : '') + current + INDEX_MARKERS.MARKER;
    };
    ViewControllerListItem.prototype.getHTML = function () {
        var _this = this;
        var matchMatches = null;
        var markersMatches = [];
        this._highlight.backgroundColor = this.highlight.backgroundColor;
        this._highlight.foregroundColor = this.highlight.foregroundColor;
        this.html = tools_htmlserialize_1.serializeHTML(this.val);
        if (typeof this.match === 'string' && this.match !== null && this.match !== '') {
            var reg = null;
            if (!this.matchReg) {
                this.match = tools_regexp_1.serializeStringForReg(this.match);
                this.regsCache[this.match + '_noReg'] === void 0 && (this.regsCache[this.match + '_noReg'] = tools_regexp_1.safelyCreateRegExp(tools_htmlserialize_1.serializeHTML(this.match), 'g'));
                reg = this.regsCache[this.match + '_noReg'];
            }
            else {
                this.regsCache[this.match] === void 0 && (this.regsCache[this.match] = tools_regexp_1.safelyCreateRegExp(tools_htmlserialize_1.serializeHTML(this.match), 'gi'));
                reg = this.regsCache[this.match];
            }
            this.regsCache[MARKERS.MATCH] === void 0 && (this.regsCache[MARKERS.MATCH] = tools_regexp_1.safelyCreateRegExp(MARKERS.MATCH, 'gi'));
            if (reg !== null) {
                matchMatches = this.html.match(reg);
                if (matchMatches instanceof Array && matchMatches.length > 0) {
                    this.html = this.html.replace(reg, MARKERS.MATCH);
                }
            }
        }
        if (this.markers instanceof Array) {
            this.markers.forEach(function (marker, index) {
                if (marker.value.length > 0) {
                    var matches = null;
                    var mark = "" + MARKERS.MARKER_LEFT + index + MARKERS.MARKER_RIGHT;
                    _this.regsCache[marker.value] === void 0 && (_this.regsCache[marker.value] = tools_regexp_1.safelyCreateRegExp(tools_htmlserialize_1.serializeHTML(tools_regexp_1.serializeStringForReg(marker.value)), 'gi'));
                    _this.regsCache[mark] === void 0 && (_this.regsCache[mark] = tools_regexp_1.safelyCreateRegExp(tools_htmlserialize_1.serializeHTML(tools_regexp_1.serializeStringForReg(mark)), 'gi'));
                    if (_this.regsCache[marker.value] !== null) {
                        matches = _this.html.match(_this.regsCache[marker.value]);
                        if (matches instanceof Array && matches.length > 0) {
                            _this.html = _this.html.replace(_this.regsCache[marker.value], mark);
                            markersMatches.push({
                                mark: mark,
                                matches: matches,
                                bg: _this.markerSelectMode === MARKERS_SELECTION_MODE.LINES ? 'rgba(250,0,0,1)' : marker.backgroundColor,
                                fg: _this.markerSelectMode === MARKERS_SELECTION_MODE.LINES ? 'rgba(250,250,250,1)' : marker.foregroundColor,
                                _bg: marker.backgroundColor,
                                _fg: marker.foregroundColor
                            });
                        }
                    }
                }
            });
        }
        if (matchMatches instanceof Array && matchMatches.length > 0) {
            matchMatches.forEach(function (match) {
                _this.html = _this.html.replace(MARKERS.MATCH, '<span class="match">' + match + '</span>');
            });
        }
        if (markersMatches instanceof Array && markersMatches.length > 0) {
            markersMatches.forEach(function (marker) {
                marker.matches.forEach(function (match) {
                    _this.html = _this.html.replace(marker.mark, "<span class=\"marker\" style=\"background-color: " + marker.bg + ";color:" + marker.fg + ";\">" + match + "</span>");
                });
            });
            if (this.markerSelectMode === MARKERS_SELECTION_MODE.LINES) {
                this._highlight.backgroundColor = markersMatches[0]._bg;
                this._highlight.foregroundColor = markersMatches[0]._fg;
            }
        }
        this.html = tools_ansireader_1.ANSIReader(this.html);
        this.html = tools_htmlserialize_1.parseHTML(this.html);
    };
    ViewControllerListItem.prototype.createRegExp = function (str) {
        var result = null;
        try {
            str = str.replace(/\+/gi, '\\+').replace(/\[/gi, '\\[').replace(/\\]/gi, '\\]');
            result = tools_regexp_1.safelyCreateRegExp(str, 'gi');
        }
        catch (e) { }
        return result;
    };
    ViewControllerListItem.prototype.convert = function () {
        this.safeHTML = this.sanitizer.bypassSecurityTrustHtml(this.html);
    };
    ViewControllerListItem.prototype.ngAfterContentChecked = function () {
        this.safeHTML === null && this.ngOnChanges();
    };
    ViewControllerListItem.prototype.ngOnChanges = function () {
        this.getHTML();
        this.convert();
        this.updateFilledIndex();
    };
    ViewControllerListItem.prototype.onSelect = function (event) {
        this.selected.emit(this.index);
    };
    ViewControllerListItem.prototype.onUnbookmark = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: this.GUID, index: this.index });
        this.bookmark.emit(this.index);
    };
    ViewControllerListItem.prototype.update = function (params) {
        var _this = this;
        Object.keys(params).forEach(function (key) {
            _this[key] !== void 0 && (_this[key] = params[key]);
        });
        if (this._markersHash !== this.markersHash || this._match !== this.match || this._matchReg !== this.matchReg) {
            this._markersHash = this.markersHash;
            this._match = this.match;
            this._matchReg = this.matchReg;
            this.ngOnChanges();
        }
        if (this._total_rows !== this.total_rows) {
            this._total_rows = this.total_rows;
            this.updateFilledIndex();
        }
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerListItem.prototype.onFavorite = function () {
        this.bookmarked = !this.bookmarked;
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: this.GUID, index: this.index });
        this.bookmark.emit(this.index);
    };
    return ViewControllerListItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerListItem.prototype, "GUID", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerListItem.prototype, "val", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewControllerListItem.prototype, "visibility", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewControllerListItem.prototype, "filtered", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerListItem.prototype, "match", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewControllerListItem.prototype, "matchReg", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], ViewControllerListItem.prototype, "index", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], ViewControllerListItem.prototype, "total_rows", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewControllerListItem.prototype, "selection", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ViewControllerListItem.prototype, "bookmarked", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerListItem.prototype, "markersHash", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerListItem.prototype, "markerSelectMode", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], ViewControllerListItem.prototype, "regsCache", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ViewControllerListItem.prototype, "markers", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], ViewControllerListItem.prototype, "highlight", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", core_1.EventEmitter)
], ViewControllerListItem.prototype, "selected", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", core_1.EventEmitter)
], ViewControllerListItem.prototype, "bookmark", void 0);
ViewControllerListItem = __decorate([
    core_1.Component({
        selector: 'list-view-item',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], ViewControllerListItem);
exports.ViewControllerListItem = ViewControllerListItem;
//# sourceMappingURL=component.js.map
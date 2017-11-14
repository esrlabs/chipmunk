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
var ViewControllerListItem = (function () {
    function ViewControllerListItem(changeDetectorRef, sanitizer) {
        this.changeDetectorRef = changeDetectorRef;
        this.sanitizer = sanitizer;
        this.GUID = '';
        this.val = '';
        this.visibility = true;
        this.filtered = false;
        this.match = '';
        this.index = 0;
        this.total_rows = 0;
        this.selection = false;
        this.bookmarked = false;
        this.markersHash = '';
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
        this.changeDetectorRef = changeDetectorRef;
        this.sanitizer = sanitizer;
    }
    ViewControllerListItem.prototype.ngOnDestroy = function () {
    };
    ViewControllerListItem.prototype.updateFilledIndex = function () {
        var total = this.total_rows.toString(), current = this.index.toString();
        this.__index = (total.length - current.length > 0 ? ('0'.repeat(total.length - current.length)) : '') + current;
    };
    ViewControllerListItem.prototype.getHTML = function () {
        var _this = this;
        this.html = this.val;
        if (typeof this.match === 'string' && this.match !== null && this.match !== '') {
            var matches = null, mark_1 = '<@-=!=-@>';
            this.regsCache[this.match] === void 0 && (this.regsCache[this.match] = new RegExp(this.match, 'gi'));
            this.regsCache[mark_1] === void 0 && (this.regsCache[mark_1] = new RegExp(mark_1, 'gi'));
            matches = this.html.match(this.regsCache[this.match]);
            if (matches instanceof Array && matches.length > 0) {
                matches.forEach(function (match) {
                    var _match = match.substr(0, 1) + mark_1 + match.substr(1, match.length - 1);
                    _this.html = _this.html.replace(match, '<span class="match">' + _match + '</span>');
                });
                this.html = this.html.replace(this.regsCache[mark_1], '');
            }
        }
    };
    ViewControllerListItem.prototype.addMarkers = function () {
        var _this = this;
        if (this.markers instanceof Array) {
            this.markers.forEach(function (marker) {
                var matches = null, mark = '<@-=!=-@>';
                _this.regsCache[marker.value] === void 0 && (_this.regsCache[marker.value] = _this.createRegExp(marker.value));
                _this.regsCache[mark] === void 0 && (_this.regsCache[mark] = _this.createRegExp(mark));
                if (_this.regsCache[marker.value] !== null) {
                    matches = _this.html.match(_this.regsCache[marker.value]);
                    if (matches instanceof Array && matches.length > 0) {
                        matches.forEach(function (match) {
                            var _match = match.substr(0, 1) + mark + match.substr(1, match.length - 1);
                            //this.html = this.html.replace(match, '<span class="marker" style="' + this.sanitizer.bypassSecurityTrustStyle('background-color:' + marker.color) + '">' + _match + '</span>')
                            _this.html = _this.html.replace(match, '<span class="marker" style="background-color: ' + marker.backgroundColor + ';color:' + marker.foregroundColor + ';">' + _match + '</span>');
                        });
                        _this.html = _this.html.replace(_this.regsCache[mark], '');
                    }
                }
            });
        }
    };
    ViewControllerListItem.prototype.createRegExp = function (str) {
        var result = null;
        try {
            str = str.replace(/\+/gi, '\\+').replace(/\[/gi, '\[').replace(/\\]/gi, '\\]');
            result = new RegExp(str, 'gi');
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
        this.addMarkers();
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
        if (this._markersHash !== this.markersHash || this._match !== this.match) {
            this._markersHash = this.markersHash;
            this._match = this.match;
            this.ngOnChanges();
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
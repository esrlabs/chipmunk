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
var tools_ansiclear_1 = require("../../../core/modules/tools.ansiclear");
var COLORS = {
    BACKGROUND: 'rgba(0,0,0,1);'
};
var MODES = {
    SCROLL: Symbol(),
    REVIEW: Symbol()
};
var ViewControllerListLine = (function () {
    function ViewControllerListLine(changeDetectorRef, viewContainerRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.viewContainerRef = viewContainerRef;
        this.GUID = '';
        this.marks = [];
        this.count = 0;
        this.scroll = null;
        this.scrollTo = null;
        this.offsetTop = 0;
        this.offsetBottom = 0;
        this.top = 0;
        this.height = 0;
        this.modes = MODES;
        this.mode = MODES.SCROLL;
        this.selection = {
            top: '0px',
            list: []
        };
        this.size = {
            width: -1,
            height: -1
        };
        this.context = null;
        this.needToBeUpdated = false;
        this.changeDetectorRef = changeDetectorRef;
        this.viewContainerRef = viewContainerRef;
    }
    ViewControllerListLine.prototype.ngOnDestroy = function () {
    };
    ViewControllerListLine.prototype.resize = function (soft) {
        if (soft === void 0) { soft = false; }
        if (this.viewContainerRef !== void 0 && this.canvasContainerRef !== void 0 &&
            this.viewContainerRef !== null && this.canvasContainerRef !== null) {
            var size = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
            this.size.width = size.width;
            this.size.height = size.height;
            soft && this.forceUpdate();
        }
    };
    ViewControllerListLine.prototype.setupSize = function () {
        if (this.size.width < 0 || this.size.height < 0) {
            this.resize();
        }
    };
    ViewControllerListLine.prototype.setupContext = function () {
        if (this.context === null && this.canvasContainerRef !== void 0 && this.canvasContainerRef !== null) {
            this.context = this.canvasContainerRef.element.nativeElement.getContext('2d');
        }
    };
    ViewControllerListLine.prototype.clearDraw = function () {
        if (this.context !== null) {
            this.context.clearRect(0, 0, this.size.width, this.getHeight());
        }
    };
    ViewControllerListLine.prototype.drawScroll = function () {
        if (this.context !== null && this.scroll !== null && this.marks.length > 0) {
            var minHeight = 2, rate = this.getHeight(this.scroll.viewHeight) / this.scroll.scrollHeight, height = this.getHeight(this.scroll.viewHeight) * rate, top_1 = this.scroll.scrollTop * rate;
            height = height < minHeight ? minHeight : height;
            top_1 = top_1 > this.getHeight(this.scroll.viewHeight) - height ? this.getHeight(this.scroll.viewHeight) - height : top_1;
            this.context.fillStyle = 'rgba(0,0,255,0.4)';
            this.context.fillRect(0, top_1, this.size.width, height);
        }
    };
    ViewControllerListLine.prototype.drawMarks = function () {
        var _this = this;
        if (this.context !== null) {
            var rate_1 = this.getHeight() / this.count, height_1 = rate_1 < 1 ? 1 : rate_1;
            this.marks.forEach(function (mark) {
                var y = mark.position * rate_1;
                _this.context.fillStyle = mark.color;
                _this.context.fillRect(0, y, _this.size.width, height_1);
            });
            this.needToBeUpdated = false;
        }
        else {
            this.needToBeUpdated = true;
        }
    };
    ViewControllerListLine.prototype.checkUpdate = function () {
        if (this.needToBeUpdated) {
            this.drawMarks();
            this.drawScroll();
        }
    };
    ViewControllerListLine.prototype.onMouseMove = function (event) {
        var _this = this;
        var rate = this.getHeight() / this.count, position = event.layerY / rate, offset = this.count * 0.10, limit = 10;
        if (this.marks.length > 0) {
            offset = offset <= 0 ? 1 : (offset > 100 ? 100 : offset);
            this.selection.list = [];
            this.selection.top = event.layerY + 'px';
            this.marks.forEach(function (mark) {
                if (limit >= _this.selection.list.length) {
                    if (mark.position > (position - offset) && mark.position < (position + offset)) {
                        _this.selection.list.push({
                            html: tools_ansiclear_1.ANSIClearer(mark.str),
                            onClick: mark.onClick
                        });
                    }
                }
            });
            this.forceUpdate();
        }
    };
    ViewControllerListLine.prototype.onClick = function (event) {
        var rate = event.layerY / this.getHeight(), position = Math.ceil(this.count * rate);
        this.scrollTo.emit(position);
    };
    ViewControllerListLine.prototype.onMouseLeave = function () {
        this.selection.list = [];
    };
    ViewControllerListLine.prototype.ngAfterContentChecked = function () {
        this.setupContext();
        this.setupSize();
        this.checkUpdate();
    };
    ViewControllerListLine.prototype.ngOnChanges = function () {
        this.clearDraw();
        this.resize(true);
        this.drawMarks();
        this.drawScroll();
    };
    ViewControllerListLine.prototype.onSelect = function (event) {
    };
    ViewControllerListLine.prototype.onScroll = function (event) {
        console.log(event);
    };
    ViewControllerListLine.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerListLine.prototype.getTopOffset = function () {
        return this.offsetTop + 'px';
    };
    ViewControllerListLine.prototype.getHeight = function (height) {
        return ((typeof height === 'number' ? height : this.size.height) - this.offsetTop - this.offsetBottom);
    };
    ViewControllerListLine.prototype.getScrollHeight = function () {
        return (this.scroll !== null ? this.scroll.scrollHeight : 0) + 'px';
    };
    return ViewControllerListLine;
}());
__decorate([
    core_1.ViewChild('canvas', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ViewControllerListLine.prototype, "canvasContainerRef", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewControllerListLine.prototype, "GUID", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ViewControllerListLine.prototype, "marks", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], ViewControllerListLine.prototype, "count", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], ViewControllerListLine.prototype, "scroll", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], ViewControllerListLine.prototype, "scrollTo", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], ViewControllerListLine.prototype, "offsetTop", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Number)
], ViewControllerListLine.prototype, "offsetBottom", void 0);
ViewControllerListLine = __decorate([
    core_1.Component({
        selector: 'list-view-line',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef,
        core_1.ViewContainerRef])
], ViewControllerListLine);
exports.ViewControllerListLine = ViewControllerListLine;
//# sourceMappingURL=component.js.map
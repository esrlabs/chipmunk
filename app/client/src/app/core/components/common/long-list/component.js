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
var SETTINGS = {
    END_SCROLL_OFFSET: 0,
    BEGIN_SCROLL_OFFSET: 0,
    FILLER_OFFSET: 0
};
var LongList = (function () {
    function LongList(element, ref, viewRef, compiler) {
        this.element = element;
        this.ref = ref;
        this.viewRef = viewRef;
        this.compiler = compiler;
        /*
        * Incomes declaration
        * */
        this.rows = [];
        this.cssClass = '';
        this.onScroll = new core_1.EventEmitter();
        this.GUID = '';
        /*
        * Internal declaration
        * */
        this.component = {
            node: null,
            height: 0,
            expectedHeight: 0,
            filler: '',
            ref: null
        };
        this.state = {
            rows: [],
            start: 0,
            distance: 0,
            end: 1,
            ready: false,
            offset: '',
            buffer: 10,
            scrollTop: -1000,
            count: -1
        };
        this.row = {
            height: 0,
            node: null,
            selector: 'li:first-child'
        };
        this.component.node = element.nativeElement;
        this.component.ref = ref;
    }
    LongList.prototype.forceUpdate = function () {
        this.component.ref.detectChanges();
    };
    LongList.prototype.update = function (recalculate) {
        if (recalculate === void 0) { recalculate = false; }
        recalculate && this.forceCalculation();
        this.updateState();
        this.initRowNode();
        this.initRowSize();
        this.updateSize();
        this.checkCount();
        this.forceUpdate();
    };
    LongList.prototype.forceCalculation = function () {
        this.calculate(this.wrapper.element.nativeElement.scrollTop, true);
        this.state.rows.forEach(function (row) {
            typeof row.forceUpdate === 'function' && row.forceUpdate(row.params);
        });
    };
    LongList.prototype.checkCount = function () {
        if (this.rows.length !== this.state.count && this.state.count !== -1) {
            var wrapper = this.wrapper.element.nativeElement;
            //wrapper.scrollTop   = wrapper.scrollTop * (this.rows.length / this.state.count);
            this.calculate(wrapper.scrollTop, true);
            this.state.rows.forEach(function (row) {
                typeof row.forceUpdate === 'function' && row.forceUpdate(row.params);
            });
        }
        this.state.count = this.rows.length;
    };
    LongList.prototype.initRowNode = function () {
        if (this.row.node === null && this.li !== void 0 && this.li.length > 0) {
            this.row.node = this.li.first.element.nativeElement;
        }
    };
    LongList.prototype.initRowSize = function () {
        if (this.row.node !== null && !this.state.ready) {
            this.row.height = this.row.node.getBoundingClientRect().height;
            this.row.height > 0 && (this.state.ready = true);
            this.row.height > 0 && this.calculate(0);
            this.row.height > 0 && this.updateState();
            this.row.height > 0 && this.forceUpdate();
        }
    };
    LongList.prototype.updateSize = function () {
        this.component.height = this.component.node.getBoundingClientRect().height;
    };
    LongList.prototype.updateState = function () {
        this.state.rows = this.rows.slice(this.state.start, this.state.end);
    };
    LongList.prototype.calculate = function (scrollTop, force) {
        if (force === void 0) { force = false; }
        if (force || (scrollTop !== this.state.scrollTop && Math.abs(scrollTop - this.state.scrollTop) >= this.row.height)) {
            var start = Math.floor(scrollTop / this.row.height), height = this.row.height * this.rows.length;
            this.component.height === 0 && this.updateSize();
            start = start < 0 ? 0 : (start > height ? 0 : start);
            this.state.scrollTop = scrollTop > height ? height : scrollTop;
            this.state.start = this.state.buffer > start ? start : (start - this.state.buffer);
            this.state.distance = Math.ceil(this.component.height / this.row.height) + this.state.buffer * 2;
            this.state.end = this.state.start + this.state.distance;
            this.component.filler = (height + SETTINGS.FILLER_OFFSET) + 'px';
            this.state.offset = this.state.scrollTop - (start < this.state.buffer ? 0 : (this.state.buffer * this.row.height)) + 'px';
            this.component.expectedHeight = height + this.row.height;
        }
    };
    LongList.prototype.onScrollEvent = function (event) {
        var scrollEvent = {
            scrollHeight: event.target.scrollHeight,
            scrollTop: event.target.scrollTop,
            viewHeight: this.component.height,
            isScrolledToBegin: false,
            isScrolledToEnd: false
        };
        this.calculate(event.target.scrollTop, false);
        this.updateState();
        if (event.target.scrollHeight > this.component.height) {
            if ((event.target.scrollTop + this.component.height) >= this.component.expectedHeight - SETTINGS.END_SCROLL_OFFSET) {
                scrollEvent.isScrolledToEnd = true;
            }
        }
        if (event.target.scrollTop <= SETTINGS.BEGIN_SCROLL_OFFSET) {
            scrollEvent.isScrolledToBegin = true;
        }
        this.onScroll.emit(scrollEvent);
    };
    LongList.prototype.getScrollState = function () {
        var scrollEvent = {
            scrollHeight: this.wrapper.element.nativeElement.scrollHeight,
            scrollTop: this.wrapper.element.nativeElement.scrollTop,
            viewHeight: this.component.height,
            isScrolledToBegin: false,
            isScrolledToEnd: false
        };
        return scrollEvent;
    };
    LongList.prototype.onResize = function () {
        this.component.height = this.component.node.getBoundingClientRect().height;
        this.calculate(this.state.scrollTop, true);
        this.updateState();
    };
    LongList.prototype.scrollToIndex = function (index) {
        var wrapper = this.wrapper.element.nativeElement;
        var scrollTop = this.row.height * (index + 1);
        if (wrapper.scrollTop === scrollTop) {
            return false;
        }
        wrapper.scrollTo(wrapper.scrollLeft, scrollTop);
        //wrapper.scrollTop = scrollTop;
    };
    LongList.prototype.ngAfterViewChecked = function () {
        this.update();
    };
    return LongList;
}());
__decorate([
    core_1.ViewChildren('li', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.QueryList)
], LongList.prototype, "li", void 0);
__decorate([
    core_1.ViewChild('ul', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], LongList.prototype, "ul", void 0);
__decorate([
    core_1.ViewChild('wrapper', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], LongList.prototype, "wrapper", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], LongList.prototype, "rows", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], LongList.prototype, "cssClass", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], LongList.prototype, "onScroll", void 0);
LongList = __decorate([
    core_1.Component({
        selector: 'long-list',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ElementRef,
        core_1.ChangeDetectorRef,
        core_1.ViewContainerRef,
        core_1.Compiler])
], LongList);
exports.LongList = LongList;
//# sourceMappingURL=component.js.map
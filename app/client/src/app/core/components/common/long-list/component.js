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
    FILLER_OFFSET: 16,
    SCROLL_BAR_OFFSET: 15,
    BORDER_TIMEOUT: 1000,
    BORDER_ATTEMPTS: 10,
    SCROLL_TOP_OFFSET: 15
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
            maxScrollTop: 0,
            topOffset: 15,
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
            count: -1,
            previousST: -1
        };
        this.row = {
            height: 0,
            node: null,
            selector: 'li:first-child'
        };
        this.borders = {
            top: false,
            bottom: false,
            bottomCSSClass: '',
            topCSSClass: '',
            bottomPosition: '10000px',
            timer: -1,
            counter: 0,
            left: '0px',
            previousST: 0
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
        var height = this.row.height * this.rows.length;
        this.component.height = this.component.node.getBoundingClientRect().height;
        this.component.maxScrollTop = height - this.component.height + SETTINGS.SCROLL_BAR_OFFSET;
        this.borders.bottomPosition = (height - 40) + 'px';
    };
    LongList.prototype.updateState = function () {
        this.state.rows = this.rows.slice(this.state.start, this.state.end);
    };
    LongList.prototype.checkBorders = function (scrollTop, scrollLeft) {
        if (scrollTop === this.borders.previousST) {
            this.borders.counter += 1;
            if (this.borders.counter > SETTINGS.BORDER_ATTEMPTS) {
                this.borders.counter = 0;
                if (scrollTop === SETTINGS.SCROLL_TOP_OFFSET || Math.abs(scrollTop - this.component.maxScrollTop) <= 1) {
                    this.borders.timer !== -1 && clearTimeout(this.borders.timer);
                    this.borders.timer = setTimeout(this.offBorders.bind(this), SETTINGS.BORDER_TIMEOUT);
                }
                if (scrollTop === SETTINGS.SCROLL_TOP_OFFSET) {
                    this.borders.top = true;
                    this.borders.bottom = false;
                    this.onBorders();
                }
                else if (Math.abs(scrollTop - this.component.maxScrollTop) <= 1) {
                    this.borders.top = false;
                    this.borders.bottom = true;
                    this.onBorders();
                }
            }
        }
        else {
            this.borders.counter = 0;
        }
        this.borders.left = scrollLeft + 'px';
        this.borders.previousST = scrollTop;
    };
    LongList.prototype.onBorders = function () {
        this.borders.timer !== -1 && clearTimeout(this.borders.timer);
        this.borders.bottomCSSClass = 'on';
        this.borders.topCSSClass = 'on';
        this.borders.timer = setTimeout(this.offBorders.bind(this), SETTINGS.BORDER_TIMEOUT);
        this.forceUpdate();
    };
    LongList.prototype.offBorders = function () {
        this.borders.timer !== -1 && clearTimeout(this.borders.timer);
        this.borders.bottomCSSClass = 'off';
        this.borders.topCSSClass = 'off';
        this.borders.timer = setTimeout(this.resetBorders.bind(this), SETTINGS.BORDER_TIMEOUT);
        this.forceUpdate();
    };
    LongList.prototype.resetBorders = function () {
        this.borders.top = false;
        this.borders.bottom = false;
        this.borders.bottomCSSClass = '';
        this.borders.topCSSClass = '';
        this.borders.timer = -1;
        this.borders.counter = 0;
    };
    LongList.prototype.calculate = function (scrollTop, force) {
        if (force === void 0) { force = false; }
        if (force || (scrollTop !== this.state.scrollTop && Math.abs(scrollTop - this.state.scrollTop) >= this.row.height)) {
            var start = Math.floor((scrollTop - SETTINGS.SCROLL_TOP_OFFSET) / this.row.height), height = this.row.height * this.rows.length, rendered = 0, offset = 0;
            this.component.height === 0 && this.updateSize();
            start = start < 0 ? 0 : (start > height ? 0 : start);
            this.state.scrollTop = scrollTop > height ? height : scrollTop;
            this.state.start = this.state.buffer > start ? start : (start - this.state.buffer);
            this.state.distance = Math.ceil(this.component.height / this.row.height) + this.state.buffer * 2;
            this.state.end = this.state.start + this.state.distance;
            this.component.filler = (height + SETTINGS.FILLER_OFFSET) + 'px';
            offset = this.state.scrollTop - (start < this.state.buffer ? 0 : (this.state.buffer * this.row.height));
            rendered = (this.state.end > this.rows.length ? this.rows.length : this.state.end) - this.state.start;
            if (this.row.height * rendered + offset > height) {
                offset = offset - ((this.row.height * rendered + offset) - height);
            }
            this.state.offset = offset - SETTINGS.SCROLL_TOP_OFFSET + 'px';
            this.component.expectedHeight = height;
        }
    };
    LongList.prototype.onScrollEvent = function (event) {
        //Correction of bottom scroll
        if ((event.target.scrollTop + this.component.height) > this.row.height * this.rows.length && event.target.scrollTop > this.state.previousST) {
            event.target.scrollTop = this.component.maxScrollTop;
        }
        else if ((event.target.scrollTop + this.component.height) > this.row.height * this.rows.length && event.target.scrollTop < this.state.previousST) {
            this.offBorders();
        }
        //Correction of top scroll
        if (event.target.scrollTop < SETTINGS.SCROLL_TOP_OFFSET) {
            event.target.scrollTop = SETTINGS.SCROLL_TOP_OFFSET;
        }
        this.state.previousST = event.target.scrollTop;
        var scrollEvent = {
            scrollHeight: event.target.scrollHeight,
            scrollTop: event.target.scrollTop,
            viewHeight: this.component.height,
            isScrolledToBegin: false,
            isScrolledToEnd: false
        };
        //Check border
        this.checkBorders(scrollEvent.scrollTop, event.target.scrollLeft);
        //Make calculation
        this.calculate(event.target.scrollTop, false);
        this.updateState();
        if (event.target.scrollHeight > this.component.height) {
            if ((event.target.scrollTop + this.component.height) >= this.component.expectedHeight) {
                scrollEvent.isScrolledToEnd = true;
            }
        }
        if (event.target.scrollTop <= SETTINGS.BEGIN_SCROLL_OFFSET) {
            scrollEvent.isScrolledToBegin = true;
        }
        this.onScroll.emit(scrollEvent);
    };
    LongList.prototype.getScrollState = function () {
        var nativeElement = this.wrapper.element.nativeElement;
        var scrollEvent = {
            scrollHeight: nativeElement.scrollHeight,
            scrollTop: nativeElement.scrollTop,
            viewHeight: this.component.height,
            isScrolledToBegin: nativeElement.scrollTop <= SETTINGS.BEGIN_SCROLL_OFFSET,
            isScrolledToEnd: nativeElement.scrollHeight > this.component.height ? ((nativeElement.scrollTop + this.component.height) >= this.component.expectedHeight) : false
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
        if (typeof wrapper.scrollTo === 'function') {
            wrapper.scrollTo(wrapper.scrollLeft, scrollTop);
        }
        else {
            wrapper.scrollTop = scrollTop;
        }
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
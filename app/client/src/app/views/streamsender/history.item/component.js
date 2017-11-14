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
var StreamSenderHistoryItem = (function () {
    function StreamSenderHistoryItem(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
        this.item = null;
        this.onChange = null;
        this.onTyping = null;
        this.onRemove = null;
        this.before = '';
        this.after = '';
        this.bound = false;
        this.componentFactoryResolver = componentFactoryResolver;
        this.viewContainerRef = viewContainerRef;
        this.changeDetectorRef = changeDetectorRef;
    }
    StreamSenderHistoryItem.prototype.ngOnInit = function () {
    };
    StreamSenderHistoryItem.prototype.ngOnDestroy = function () {
        this.onChange.unsubscribe();
        this.onTyping.unsubscribe();
    };
    StreamSenderHistoryItem.prototype.ngAfterViewInit = function () {
        if (!this.bound) {
            this.bound = true;
            this.handleOnChange = this.handleOnChange.bind(this);
            this.handleOnTyping = this.handleOnTyping.bind(this);
            this.onChange.subscribe(this.handleOnChange);
            this.onTyping.subscribe(this.handleOnTyping);
        }
        this.updateSelected('');
    };
    StreamSenderHistoryItem.prototype.updateSelected = function (typed) {
        if (this.item.value.indexOf(typed) === 0) {
            this.before = typed;
            this.after = this.item.value.replace(typed, '');
        }
        else {
            this.before = '';
            this.after = this.item.value;
        }
    };
    StreamSenderHistoryItem.prototype.handleOnChange = function (item) {
        var _this = this;
        Object.keys(item).forEach(function (key) {
            _this.item[key] = item[key];
        });
        this.forceUpdate();
    };
    StreamSenderHistoryItem.prototype.handleOnTyping = function (typed) {
        this.updateSelected(typed);
        this.forceUpdate();
    };
    StreamSenderHistoryItem.prototype.onRemoveItem = function (event) {
        this.onRemove();
        event.preventDefault();
        return false;
    };
    StreamSenderHistoryItem.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    return StreamSenderHistoryItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], StreamSenderHistoryItem.prototype, "item", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], StreamSenderHistoryItem.prototype, "onChange", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", core_1.EventEmitter)
], StreamSenderHistoryItem.prototype, "onTyping", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], StreamSenderHistoryItem.prototype, "onRemove", void 0);
StreamSenderHistoryItem = __decorate([
    core_1.Component({
        selector: 'stream-sender-history-item',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], StreamSenderHistoryItem);
exports.StreamSenderHistoryItem = StreamSenderHistoryItem;
//# sourceMappingURL=component.js.map
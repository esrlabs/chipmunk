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
var ColorsCanvasDialog = (function () {
    function ColorsCanvasDialog(viewContainerRef) {
        this.viewContainerRef = viewContainerRef;
        this.callback = null;
        this.box = {
            width: 50,
            height: 50,
            context: null,
            redraw: true,
            color: 'rgba(255, 0, 0, 1)'
        };
        this.line = {
            width: 10,
            height: 50,
            context: null,
            redraw: true
        };
        this.size = {
            width: -1,
            height: -1,
        };
    }
    ColorsCanvasDialog.prototype.ngAfterViewChecked = function () {
        this.resize();
        this.applySizes();
        this.getContext();
        this.drawLine();
        this.drawBox();
    };
    ColorsCanvasDialog.prototype.getContext = function () {
        if (this.box.context === null || this.line.context === null) {
            this.box.context = this.boxRef.element.nativeElement.getContext('2d');
            this.line.context = this.lineRef.element.nativeElement.getContext('2d');
        }
    };
    ColorsCanvasDialog.prototype.resize = function () {
        var size = this.viewContainerRef.element.nativeElement.getBoundingClientRect(), box = 0.8, redraw = false;
        size.width !== this.size.width && (redraw = true);
        size.height !== this.size.height && (redraw = true);
        if (redraw) {
            this.box.width = Math.round(size.width * box);
            this.line.width = size.width - this.box.width;
            this.box.height = size.height;
            this.line.height = size.height;
            this.size.width = size.width;
            this.size.height = size.height;
            this.box.redraw = redraw;
            this.line.redraw = redraw;
        }
    };
    ColorsCanvasDialog.prototype.applySizes = function () {
        if (this.box.redraw || this.line.redraw) {
            this.boxRef.element.nativeElement.width = this.box.width;
            this.boxRef.element.nativeElement.height = this.box.height;
            this.lineRef.element.nativeElement.width = this.line.width;
            this.lineRef.element.nativeElement.height = this.line.height;
        }
    };
    ColorsCanvasDialog.prototype.drawBox = function () {
        if (this.box.context !== null && this.box.redraw) {
            var grdWhite = this.box.context.createLinearGradient(0, 0, this.box.width, 0), grdBlack = this.box.context.createLinearGradient(0, 0, 0, this.box.height);
            this.box.context.fillStyle = this.box.color;
            this.box.context.fillRect(0, 0, this.box.width, this.box.height);
            grdWhite.addColorStop(0, 'rgba(255,255,255,1)');
            grdWhite.addColorStop(1, 'rgba(255,255,255,0)');
            this.box.context.fillStyle = grdWhite;
            this.box.context.fillRect(0, 0, this.box.width, this.box.height);
            grdBlack.addColorStop(0, 'rgba(0,0,0,0)');
            grdBlack.addColorStop(1, 'rgba(0,0,0,1)');
            this.box.context.fillStyle = grdBlack;
            this.box.context.fillRect(0, 0, this.box.width, this.box.height);
            this.box.redraw = false;
        }
    };
    ColorsCanvasDialog.prototype.drawLine = function () {
        if (this.line.context !== null && this.line.redraw) {
            var gradient_1 = this.line.context.createLinearGradient(0, 0, 0, this.line.height), steps = ['rgba(255, 0, 0, 1)', 'rgba(255, 255, 0, 1)', 'rgba(0, 255, 0, 1)', 'rgba(0, 255, 255, 1)', 'rgba(0, 0, 255, 1)', 'rgba(255, 0, 255, 1)', 'rgba(255, 0, 0, 1)'], offset_1 = 1 / steps.length;
            steps.forEach(function (step, index) {
                gradient_1.addColorStop(offset_1 * index, step);
            });
            this.line.context.rect(0, 0, this.line.width, this.line.height);
            this.line.context.fillStyle = gradient_1;
            this.line.context.fill();
            this.line.redraw = false;
        }
    };
    ColorsCanvasDialog.prototype.onChangeBasicColor = function (event) {
        if (this.line.context !== null) {
            var px = this.line.context.getImageData(event.offsetX, event.offsetY, 1, 1).data;
            this.box.color = 'rgba(' + px[0] + ',' + px[1] + ',' + px[2] + ',1)';
            this.box.redraw = true;
            this.drawBox();
            typeof this.callback === 'function' && this.callback(this.box.color);
        }
    };
    ColorsCanvasDialog.prototype.onSelectColor = function (event) {
        if (this.box.context !== null) {
            var px = this.box.context.getImageData(event.offsetX, event.offsetY, 1, 1).data;
            typeof this.callback === 'function' && this.callback('rgba(' + px[0] + ',' + px[1] + ',' + px[2] + ',1)');
        }
    };
    return ColorsCanvasDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ColorsCanvasDialog.prototype, "callback", void 0);
__decorate([
    core_1.ViewChild('colorsbox', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ColorsCanvasDialog.prototype, "boxRef", void 0);
__decorate([
    core_1.ViewChild('colorsline', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ColorsCanvasDialog.prototype, "lineRef", void 0);
ColorsCanvasDialog = __decorate([
    core_1.Component({
        selector: 'colors-canvas-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ViewContainerRef])
], ColorsCanvasDialog);
exports.ColorsCanvasDialog = ColorsCanvasDialog;
//# sourceMappingURL=component.js.map
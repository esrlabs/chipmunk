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
var FileLoader = (function () {
    function FileLoader() {
        this.closer = new core_1.EventEmitter();
        this.handles = {
            onLoad: null,
            onError: null,
            onReading: null
        };
        this.minimalMouseoverEvents = 10;
        this.refMouseoverHandle = null;
        this.files = [];
        this.refMouseoverHandle = this.onMouseover.bind(this);
        window.addEventListener('mousemove', this.refMouseoverHandle);
    }
    FileLoader.prototype.ngOnDestroy = function () {
        window.removeEventListener('mousemove', this.refMouseoverHandle);
    };
    FileLoader.prototype.onMouseover = function (event) {
        if (this.minimalMouseoverEvents >= 0) {
            this.minimalMouseoverEvents -= 1;
        }
        else {
            this.close();
        }
    };
    FileLoader.prototype.open = function (handles) {
        this.handles.onLoad = typeof handles.load === 'function' ? handles.load : null;
        this.handles.onError = typeof handles.error === 'function' ? handles.error : null;
        this.handles.onReading = typeof handles.reading === 'function' ? handles.reading : null;
        this.input.element.nativeElement.click();
    };
    FileLoader.prototype.close = function () {
        this.closer.emit();
    };
    FileLoader.prototype.onChange = function (event) {
        var reader = new FileReader(), file = event.target.files[0] !== void 0 ? event.target.files[0] : null;
        if (file !== null) {
            this.files = event.target.files;
            this.handles.onReading !== null && this.handles.onReading(file);
            reader.addEventListener('load', this.onLoad.bind(this));
            reader.addEventListener('error', this.onError.bind(this));
            reader.readAsBinaryString(file);
        }
        else {
            this.close();
        }
    };
    FileLoader.prototype.onLoad = function (event) {
        this.handles.onLoad(event.target.result, this.files);
    };
    FileLoader.prototype.onError = function (event) {
        this.handles.onError(event);
    };
    return FileLoader;
}());
__decorate([
    core_1.ViewChild('input', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], FileLoader.prototype, "input", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", core_1.EventEmitter)
], FileLoader.prototype, "closer", void 0);
FileLoader = __decorate([
    core_1.Component({
        selector: 'file-loader',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], FileLoader);
exports.FileLoader = FileLoader;
//# sourceMappingURL=component.js.map
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
var Directions = {
    T: Symbol(),
    R: Symbol(),
    B: Symbol(),
    L: Symbol(),
    TL: Symbol(),
    TR: Symbol(),
    BR: Symbol(),
    BL: Symbol()
};
var Popup = (function () {
    function Popup(viewContainerRef) {
        this.viewContainerRef = viewContainerRef;
        this.closer = new core_1.EventEmitter();
        this.defaults = {
            close: true,
            addCloseHandle: true,
            css: '',
            move: true,
            resize: true,
            width: '20rem',
            height: '10rem'
        };
        this.position = { top: 0, left: 0 };
        this.size = { width: 100, height: 100 };
        this.state = {
            moving: false,
            resizing: false,
            direction: null,
            x: -1,
            y: -1
        };
        window.addEventListener('mousemove', this.onMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
    Popup.prototype.ngOnInit = function () {
        this.validateSettings();
        this.validateTitleButtons();
        this.validateButtons();
        this.defaultPosition();
        this.attachContent();
    };
    Popup.prototype.validateSetting = function (setting) {
        this.parameters.settings[setting] = this.parameters.settings[setting] === void 0 ? this.defaults[setting] : this.parameters.settings[setting];
    };
    Popup.prototype.validateSettings = function () {
        var _this = this;
        this.parameters.settings = this.parameters.settings === void 0 ? Object.assign({}, this.defaults) : this.parameters.settings;
        Object.keys(this.defaults).forEach(function (setting) {
            _this.validateSetting(setting);
        });
    };
    Popup.prototype.validateButtons = function () {
        var _this = this;
        this.parameters.buttons = this.parameters.buttons === void 0 ? [] : this.parameters.buttons;
        this.parameters.buttons = this.parameters.buttons.map(function (button) {
            button.handle = typeof button.handle === 'function' ? button.handle : function () { };
            _this.parameters.settings.addCloseHandle && (button.handle = function (handle) {
                this.close();
                handle();
            }.bind(_this, button.handle));
            return button;
        });
    };
    Popup.prototype.validateTitleButtons = function () {
        var _this = this;
        this.parameters.titlebuttons = this.parameters.titlebuttons === void 0 ? [] : this.parameters.titlebuttons;
        if (this.parameters.settings.close) {
            this.parameters.titlebuttons.push({
                icon: 'fa-close',
                hint: 'close',
                handle: this.close.bind(this)
            });
        }
        this.parameters.titlebuttons = this.parameters.titlebuttons.map(function (button) {
            button.handle = typeof button.handle === 'function' ? button.handle : function () { };
            _this.parameters.settings.addCloseHandle && (button.handle = function (handle) {
                this.close();
                handle();
            }.bind(_this, button.handle));
            return button;
        });
    };
    Popup.prototype.attachContent = function () {
        var _this = this;
        var component = this.placeholder.createComponent(this.parameters.content.factory), closer = 'closer';
        if (typeof this.parameters.content.params === 'object' && this.parameters.content.params !== null) {
            Object.keys(this.parameters.content.params).forEach(function (key) {
                component.instance[key] = _this.parameters.content.params[key];
            });
        }
        if (component.instance[closer] !== void 0) {
            component.instance[closer].subscribe(function () {
                component.destroy();
            });
        }
    };
    Popup.prototype.close = function () {
        this.closer.emit();
    };
    Popup.prototype.defaultPosition = function () {
        function setValue(prop) {
            if (typeof this.parameters.settings[prop] === 'number') {
                this.size[prop] = this.parameters.settings[prop];
            }
            else if (typeof this.parameters.settings[prop] === 'string' && ~this.parameters.settings[prop].indexOf('%')) {
                this.size[prop] = (parseInt(this.parameters.settings[prop], 10) / 100) * size[prop];
            }
            else if (typeof this.parameters.settings[prop] === 'string' && ~this.parameters.settings[prop].indexOf('em')) {
                var em = parseFloat(getComputedStyle(this.viewContainerRef.element.nativeElement).fontSize);
                this.size[prop] = parseInt(this.parameters.settings[prop], 10) * em;
            }
        }
        var size = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
        setValue.call(this, 'height');
        setValue.call(this, 'width');
        this.position.top = size.height / 2 - this.size.height / 2;
        this.position.left = size.width / 2 - this.size.width / 2;
    };
    Popup.prototype.grabCoordinates = function (event) {
        return {
            x: event.screenX,
            y: event.screenY
        };
    };
    Popup.prototype.onMove = function (event) {
        if (this.state.moving || this.state.resizing) {
            var coord = this.grabCoordinates(event);
            if (coord.x !== this.state.x || coord.y !== this.state.y) {
                if (this.state.moving) {
                    //Moving
                    this.position.top -= this.state.y - coord.y;
                    this.position.left -= this.state.x - coord.x;
                }
                else {
                    //Resizing
                    switch (this.state.direction) {
                        case Directions.T:
                            this.position.top -= this.state.y - coord.y;
                            this.size.height += this.state.y - coord.y;
                            break;
                        case Directions.R:
                            this.size.width -= this.state.x - coord.x;
                            break;
                        case Directions.B:
                            this.size.height -= this.state.y - coord.y;
                            break;
                        case Directions.L:
                            this.position.left -= this.state.x - coord.x;
                            this.size.width += this.state.x - coord.x;
                            break;
                        case Directions.TL:
                            this.position.top -= this.state.y - coord.y;
                            this.size.height += this.state.y - coord.y;
                            this.position.left -= this.state.x - coord.x;
                            this.size.width += this.state.x - coord.x;
                            break;
                        case Directions.TR:
                            this.position.top -= this.state.y - coord.y;
                            this.size.height += this.state.y - coord.y;
                            this.size.width -= this.state.x - coord.x;
                            break;
                        case Directions.BR:
                            this.size.height -= this.state.y - coord.y;
                            this.size.width -= this.state.x - coord.x;
                            break;
                        case Directions.BL:
                            this.size.height -= this.state.y - coord.y;
                            this.position.left -= this.state.x - coord.x;
                            this.size.width += this.state.x - coord.x;
                            break;
                    }
                }
                this.state.x = coord.x;
                this.state.y = coord.y;
            }
        }
    };
    Popup.prototype.onMouseDownTitle = function (event) {
        if (this.parameters.settings.move) {
            var coord = this.grabCoordinates(event);
            this.state.moving = true;
            this.state.x = coord.x;
            this.state.y = coord.y;
        }
    };
    Popup.prototype.onMouseUp = function (event) {
        this.state.moving = false;
        this.state.resizing = false;
    };
    Popup.prototype.onResize = function (event, direction) {
        if (this.parameters.settings.resize) {
            var coord = this.grabCoordinates(event);
            this.state.resizing = true;
            this.state.direction = direction;
            this.state.x = coord.x;
            this.state.y = coord.y;
        }
    };
    Popup.prototype.onResizeT = function (event) {
        this.onResize(event, Directions.T);
    };
    Popup.prototype.onResizeR = function (event) {
        this.onResize(event, Directions.R);
    };
    Popup.prototype.onResizeB = function (event) {
        this.onResize(event, Directions.B);
    };
    Popup.prototype.onResizeL = function (event) {
        this.onResize(event, Directions.L);
    };
    Popup.prototype.onResizeTL = function (event) {
        this.onResize(event, Directions.TL);
    };
    Popup.prototype.onResizeTR = function (event) {
        this.onResize(event, Directions.TR);
    };
    Popup.prototype.onResizeBR = function (event) {
        this.onResize(event, Directions.BR);
    };
    Popup.prototype.onResizeBL = function (event) {
        this.onResize(event, Directions.BL);
    };
    return Popup;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], Popup.prototype, "parameters", void 0);
__decorate([
    core_1.Output(),
    __metadata("design:type", core_1.EventEmitter)
], Popup.prototype, "closer", void 0);
__decorate([
    core_1.ViewChild('placeholder', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], Popup.prototype, "placeholder", void 0);
Popup = __decorate([
    core_1.Component({
        selector: 'popup',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ViewContainerRef])
], Popup);
exports.Popup = Popup;
//# sourceMappingURL=component.js.map
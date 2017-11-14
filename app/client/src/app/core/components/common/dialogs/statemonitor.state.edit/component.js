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
var controller_1 = require("../../../common/popup/controller");
var component_1 = require("../../../common/dialogs/statemonitor.state.edit.icons/component");
var EVENTS = {
    RESET_ALL_INDICATES: 'RESET_ALL_INDICATES'
};
var StateMonitorStateEditDialog = (function () {
    function StateMonitorStateEditDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.callback = null;
        this.state = null;
        this.indicate = null;
        this._inited = false;
        this._color = 'rgb(30,30,30)';
        this._css = '';
        this._icon = '';
        this._label = '';
        this._hook = '';
        this._reset = false;
        this._itSelfResetTimeout = 0;
        this._effects = [
            {
                caption: 'No Effects',
                value: ''
            },
            {
                caption: 'Blinking',
                value: 'monitor-icon-blink'
            },
            {
                caption: 'Rotate',
                value: 'monitor-icon-rotate'
            },
        ];
        this.changeDetectorRef = changeDetectorRef;
        this.onColorChange = this.onColorChange.bind(this);
        this.onChangeEffect = this.onChangeEffect.bind(this);
        this.onIconChange = this.onIconChange.bind(this);
        this.onLabelChange = this.onLabelChange.bind(this);
        this.onHookChange = this.onHookChange.bind(this);
        this.onResetChange = this.onResetChange.bind(this);
        this.onItSelfResetTimeout = this.onItSelfResetTimeout.bind(this);
        this.onSave = this.onSave.bind(this);
        this.onCancel = this.onCancel.bind(this);
    }
    StateMonitorStateEditDialog.prototype.ngAfterContentChecked = function () {
        if (this.state !== null && !this._inited) {
            if (this.state.color !== '' && typeof this.state.color === 'string') {
                this._color = this.state.color;
            }
            if (this.state.css !== '' && typeof this.state.css === 'string') {
                this._css = this.state.css;
            }
            if (this.state.icon !== '' && typeof this.state.icon === 'string') {
                this._icon = this.state.icon;
            }
            if (this.state.label !== '' && typeof this.state.label === 'string') {
                this._label = this.state.label;
            }
            if (this.state.hook !== '' && typeof this.state.hook === 'string') {
                this._hook = this.state.hook;
            }
            if (this.state.event instanceof Array) {
                this._reset = this.state.event.indexOf(EVENTS.RESET_ALL_INDICATES) !== -1;
            }
            else {
                this._reset = false;
            }
            if (typeof this.state.offInTimeout === 'number') {
                this._itSelfResetTimeout = this.state.offInTimeout;
            }
            else {
                this._itSelfResetTimeout = 0;
            }
            this._inited = true;
        }
    };
    StateMonitorStateEditDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    StateMonitorStateEditDialog.prototype.onColorChange = function (color) {
        this._color = color;
        this.forceUpdate();
    };
    StateMonitorStateEditDialog.prototype.onChangeEffect = function (css) {
        this._css = css;
        this.forceUpdate();
    };
    StateMonitorStateEditDialog.prototype.onIconChange = function () {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.StateMonitorStateEditIconsDialog,
                params: {
                    callback: function (icon) {
                        this._icon = icon;
                        this.forceUpdate();
                        controller_1.popupController.close(popup);
                    }.bind(this)
                }
            },
            title: _('Choose an icon'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '40rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            titlebuttons: [],
            GUID: popup
        });
    };
    StateMonitorStateEditDialog.prototype.onLabelChange = function (event) {
        this._label = event.target['value'];
        this.forceUpdate();
    };
    StateMonitorStateEditDialog.prototype.onHookChange = function (event) {
        this._hook = event.target['value'];
        this.forceUpdate();
    };
    StateMonitorStateEditDialog.prototype.onResetChange = function (value) {
        this._reset = value;
        this.forceUpdate();
    };
    StateMonitorStateEditDialog.prototype.onItSelfResetTimeout = function (event) {
        this._itSelfResetTimeout = parseInt(event.target['value'], 10);
        typeof this._itSelfResetTimeout !== 'number' && (this._itSelfResetTimeout = 0);
        isNaN(this._itSelfResetTimeout) && (this._itSelfResetTimeout = 0);
        this.forceUpdate();
    };
    StateMonitorStateEditDialog.prototype.getEventName = function () {
        var events = [];
        if (this._reset) {
            events.push(EVENTS.RESET_ALL_INDICATES);
        }
        return events;
    };
    StateMonitorStateEditDialog.prototype.onSave = function () {
        typeof this.callback === 'function' && this.callback({
            label: this._label,
            hook: this._hook,
            color: this._color,
            offInTimeout: this._itSelfResetTimeout,
            event: this.getEventName(),
            css: this._css,
            icon: this._icon,
            defaults: this.state.defaults
        });
    };
    StateMonitorStateEditDialog.prototype.onCancel = function () {
        typeof this.callback === 'function' && this.callback(null);
    };
    return StateMonitorStateEditDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], StateMonitorStateEditDialog.prototype, "callback", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], StateMonitorStateEditDialog.prototype, "state", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], StateMonitorStateEditDialog.prototype, "indicate", void 0);
StateMonitorStateEditDialog = __decorate([
    core_1.Component({
        selector: 'statemonitor-state-edit-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], StateMonitorStateEditDialog);
exports.StateMonitorStateEditDialog = StateMonitorStateEditDialog;
//# sourceMappingURL=component.js.map
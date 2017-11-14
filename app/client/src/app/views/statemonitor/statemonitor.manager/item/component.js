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
var controller_1 = require("../../../../core/components/common/popup/controller");
var component_1 = require("../../../../core/components/common/dialogs/statemonitor.state.edit/component");
var component_2 = require("../../../../core/components/common/dialogs/statemonitor.indicate.edit/component");
var ViewControllerStateManagerItem = (function () {
    function ViewControllerStateManagerItem(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.indicate = null;
        this.onIndicateRemoveHandle = null;
        this.onIndicateUpdateHandle = null;
        this.changeDetectorRef = changeDetectorRef;
        this.onIndicateEdit = this.onIndicateEdit.bind(this);
    }
    ViewControllerStateManagerItem.prototype.ngOnDestroy = function () {
    };
    ViewControllerStateManagerItem.prototype.ngAfterContentChecked = function () {
    };
    ViewControllerStateManagerItem.prototype.ngOnChanges = function () {
    };
    ViewControllerStateManagerItem.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewControllerStateManagerItem.prototype.onChangeDefaults = function (state, stateIndex, defaults, setValue) {
        if (defaults) {
            this.indicate.states = this.indicate.states.map(function (state, index) {
                index !== stateIndex && (state.defaults = false);
                index === stateIndex && (state.defaults = true);
                return state;
            });
            this.save();
        }
        else {
            setValue(true);
        }
        this.forceUpdate();
    };
    ViewControllerStateManagerItem.prototype.onEdit = function (state, index) {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.StateMonitorStateEditDialog,
                params: {
                    state: state,
                    indicate: this.indicate,
                    callback: function (state) {
                        if (state !== null) {
                            if (index !== -1) {
                                //Existing state
                                this.indicate.states[index] = state;
                                this.forceUpdate();
                                this.save();
                                controller_1.popupController.close(popup);
                            }
                            else {
                                //New state
                                if (state.label !== '' && state.hook !== '') {
                                    this.indicate.states.length === 0 && (state.defaults = true);
                                    this.indicate.states.push(state);
                                    this.forceUpdate();
                                    this.save();
                                    controller_1.popupController.close(popup);
                                }
                            }
                        }
                        else {
                            controller_1.popupController.close(popup);
                        }
                    }.bind(this)
                }
            },
            title: _('Edit State Settings'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '80%',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerStateManagerItem.prototype.onIndicateEdit = function () {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.DialogStatemonitorIndicateEdit,
                params: {
                    name: this.indicate.name,
                    callback: function (name) {
                        if (typeof name === 'string' && name.trim() !== '') {
                            this.indicate.name = name;
                            this.indicate.label = name;
                            this.forceUpdate();
                            this.save();
                            controller_1.popupController.close(popup);
                        }
                    }.bind(this)
                }
            },
            title: _('Add New Indicate'),
            settings: {
                move: true,
                resize: false,
                width: '40rem',
                height: '7.5rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    ViewControllerStateManagerItem.prototype.onIndicateRemove = function () {
        typeof this.onIndicateRemoveHandle === 'function' && this.onIndicateRemoveHandle();
    };
    ViewControllerStateManagerItem.prototype.onRemove = function (state, index) {
        index >= 0 && this.indicate.states.splice(index, 1);
        !this.isDefaultSetup() && (this.indicate.states[0].defaults = true);
        this.save();
        this.forceUpdate();
    };
    ViewControllerStateManagerItem.prototype.isDefaultSetup = function () {
        var result = false;
        this.indicate.states.forEach(function (state) {
            state.defaults && (result = true);
        });
        return result;
    };
    ViewControllerStateManagerItem.prototype.onAddNewState = function () {
        this.onEdit({
            css: '',
            label: '',
            color: '',
            hook: '',
            event: [],
            icon: 'fa fa-question-circle-o',
            defaults: false
        }, -1);
    };
    ViewControllerStateManagerItem.prototype.save = function () {
        typeof this.onIndicateUpdateHandle === 'function' && this.onIndicateUpdateHandle(Object.assign({}, this.indicate));
    };
    return ViewControllerStateManagerItem;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Object)
], ViewControllerStateManagerItem.prototype, "indicate", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewControllerStateManagerItem.prototype, "onIndicateRemoveHandle", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ViewControllerStateManagerItem.prototype, "onIndicateUpdateHandle", void 0);
ViewControllerStateManagerItem = __decorate([
    core_1.Component({
        selector: 'view-controller-state-manager-item',
        templateUrl: './template.html'
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ViewControllerStateManagerItem);
exports.ViewControllerStateManagerItem = ViewControllerStateManagerItem;
//# sourceMappingURL=component.js.map
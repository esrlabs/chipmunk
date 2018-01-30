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
var service_views_1 = require("../../../services/service.views");
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var controller_dragdrop_files_1 = require("../../../modules/controller.dragdrop.files");
var controller_1 = require("../../common/popup/controller");
var component_1 = require("../../common/progressbar.circle/component");
var Holder = (function () {
    function Holder(serviceViews, viewContainerRef) {
        this.serviceViews = serviceViews;
        this.viewContainerRef = viewContainerRef;
        this.views = [];
        this.css = '';
        this.dragAndDropFiles = null;
        this.dragAndDropDialogGUID = null;
        this.onVIEWS_COLLECTION_UPDATED();
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEWS_COLLECTION_UPDATED, this.onVIEWS_COLLECTION_UPDATED.bind(this));
        window.addEventListener('resize', this.onResize.bind(this));
    }
    Holder.prototype.ngAfterViewInit = function () {
        this.onResize();
        if (this.viewContainerRef !== null && this.dragAndDropFiles === null) {
            this.dragAndDropFiles = new controller_dragdrop_files_1.DragAndDropFiles(this.viewContainerRef.element.nativeElement);
            this.dragAndDropFiles.onStart.subscribe(this.onFileLoadingStart.bind(this));
            this.dragAndDropFiles.onFinish.subscribe(this.onFileLoadingFinish.bind(this));
        }
    };
    Holder.prototype.onFileLoadingStart = function (event) {
        if (event.description !== '') {
            this._showFileLoadingProgress(event.description);
        }
    };
    Holder.prototype.onFileLoadingFinish = function (event) {
        if (event.content !== '' && event.description !== '') {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, event.description);
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, event.content);
        }
        this._hideFileLoadingProgress();
    };
    Holder.prototype._showFileLoadingProgress = function (description) {
        this.dragAndDropDialogGUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ProgressBarCircle,
                params: {}
            },
            title: 'Please, wait... Loading: ' + description,
            settings: {
                move: false,
                resize: false,
                width: '20rem',
                height: '10rem',
                close: false,
                addCloseHandle: false,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: this.dragAndDropDialogGUID
        });
    };
    Holder.prototype._hideFileLoadingProgress = function () {
        controller_1.popupController.close(this.dragAndDropDialogGUID);
    };
    Holder.prototype.onVIEWS_COLLECTION_UPDATED = function () {
        this.views = this.serviceViews.getViews();
    };
    Holder.prototype.onResize = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.HOLDER_VIEWS_RESIZE, this.viewContainerRef.element.nativeElement.getBoundingClientRect(), function () {
            return this.getBoundingClientRect();
        }.bind(this.viewContainerRef.element.nativeElement));
    };
    Holder.prototype.update = function () {
        this.views = this.views.map(function (view) {
            //Some magic here
            return view;
        });
    };
    return Holder;
}());
Holder = __decorate([
    core_1.Component({
        selector: 'holder',
        templateUrl: './template.html',
        providers: [service_views_1.ServiceViews]
    }),
    __metadata("design:paramtypes", [service_views_1.ServiceViews, core_1.ViewContainerRef])
], Holder);
exports.Holder = Holder;
//# sourceMappingURL=component.js.map
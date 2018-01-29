import { Component, ViewContainerRef, AfterViewInit     } from '@angular/core';
import { ServiceViews                                   } from '../../../services/service.views';
import { ViewClass                                      } from '../../../services/class.view';
import { events as Events                               } from '../../../modules/controller.events';
import { configuration as Configuration                 } from '../../../modules/controller.config';
import { DragAndDropFiles, DragDropFileEvent            } from '../../../modules/controller.dragdrop.files';
import {popupController} from "../../common/popup/controller";
import {ProgressBarCircle} from "../../common/progressbar.circle/component";

@Component({
    selector    : 'holder',
    templateUrl : './template.html',
    providers   : [ServiceViews]
})

export class Holder implements AfterViewInit{
    views : Array<ViewClass>    = [];

    css   : String              = '';

    private dragAndDropFiles        : DragAndDropFiles  = null;
    private dragAndDropDialogGUID   : symbol            = null;

    constructor(private serviceViews : ServiceViews, private viewContainerRef: ViewContainerRef){
        this.onVIEWS_COLLECTION_UPDATED();
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEWS_COLLECTION_UPDATED,  this.onVIEWS_COLLECTION_UPDATED.bind(this));
        window.addEventListener('resize', this.onResize.bind(this));
    }

    ngAfterViewInit(){
        this.onResize();
        if (this.viewContainerRef !== null && this.dragAndDropFiles === null) {
            this.dragAndDropFiles = new DragAndDropFiles(this.viewContainerRef.element.nativeElement);
            this.dragAndDropFiles.onStart.subscribe(this.onFileLoadingStart.bind(this));
            this.dragAndDropFiles.onFinish.subscribe(this.onFileLoadingFinish.bind(this));
        }
    }

    onFileLoadingStart(event: DragDropFileEvent){
        if (event.description !== '') {
            this._showFileLoadingProgress(event.description);
        }
    }

    onFileLoadingFinish(event: DragDropFileEvent){
        if (event.content !== '' && event.description !== '') {
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, event.description);
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, event.content);
        }
        this._hideFileLoadingProgress();
    }

    _showFileLoadingProgress(description: string){
        this.dragAndDropDialogGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : 'Please, wait... Loading: ' + description,
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '10rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : this.dragAndDropDialogGUID
        });
    }

    _hideFileLoadingProgress(){
        popupController.close(this.dragAndDropDialogGUID);
    }

    onVIEWS_COLLECTION_UPDATED(){
        this.views = this.serviceViews.getViews();
    }

    onResize(){
        Events.trigger(
            Configuration.sets.SYSTEM_EVENTS.HOLDER_VIEWS_RESIZE,
            this.viewContainerRef.element.nativeElement.getBoundingClientRect(),
            function(){
                return this.getBoundingClientRect();
            }.bind(this.viewContainerRef.element.nativeElement)
        );
    }

    update(){
        this.views = this.views.map((view)=>{
            //Some magic here
            return view;
        });
    }
}

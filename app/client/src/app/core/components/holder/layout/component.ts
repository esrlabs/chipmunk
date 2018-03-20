import { Component, ViewContainerRef, AfterViewChecked  } from '@angular/core';
import { ServiceViews                                   } from '../../../services/service.views';
import { ViewClass                                      } from '../../../services/class.view';
import { events as Events                               } from '../../../modules/controller.events';
import { configuration as Configuration                 } from '../../../modules/controller.config';

@Component({
    selector    : 'holder',
    templateUrl : './template.html',
    providers   : [ServiceViews]
})

export class Holder implements AfterViewChecked{
    views : Array<ViewClass>    = [];

    css   : String              = '';

    private _sizeIsInitied: boolean = false;

    constructor(private serviceViews : ServiceViews, private viewContainerRef: ViewContainerRef){
        this.onVIEWS_COLLECTION_UPDATED();
        Events.bind(Configuration.sets.SYSTEM_EVENTS.VIEWS_COLLECTION_UPDATED,  this.onVIEWS_COLLECTION_UPDATED.bind(this));
        window.addEventListener('resize', this.onResize.bind(this));
    }

    ngAfterViewChecked(){
        if (!this._sizeIsInitied && this.viewContainerRef !== null) {
            const size = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
            if (size.height <= 0 || size.width <= 0){
                return false;
            }
            this.sendUpdatedSize();
            this._sizeIsInitied = true;
        }
    }

    onVIEWS_COLLECTION_UPDATED(){
        this.views = this.serviceViews.getViews();
    }

    onResize(){
        this.sendUpdatedSize();
    }

    sendUpdatedSize(){
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

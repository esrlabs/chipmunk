import { Component, ChangeDetectorRef, OnInit   } from '@angular/core';
import { events as Events                       } from '../../../modules/controller.events';
import { configuration                          } from '../../../modules/controller.config';
import { ServiceTopBarButtons                   } from '../../../services/service.topbar.buttons';
import { ToolBarButton                          } from '../../../services/class.toolbar.button';

@Component({
    selector    : 'topbar-space-holder',
    templateUrl : './template.html',
    providers   : [ ServiceTopBarButtons ]
})

export class TopBarSpaceHolder implements OnInit {
    shortcuts   : Array<ToolBarButton> = [ ];
    description : string;
    constructor(
        private changeDetectorRef   : ChangeDetectorRef,
        private serviceTopBarButtons: ServiceTopBarButtons
    ) {
        this.description = 'Welcome to LogViewer';
        Events.bind(configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, this.onDESCRIPTION_OF_STREAM_UPDATED.bind(this));
    }

    getButtons(){
        this.serviceTopBarButtons.getItems().then((items)=>{
            this.shortcuts = items;
        });
    }

    ngOnInit(){
        this.getButtons();
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onDESCRIPTION_OF_STREAM_UPDATED(description : string){
        this.description = description;
        this.forceUpdate();
    }
}

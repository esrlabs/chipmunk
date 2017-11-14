import { Component, Input               } from '@angular/core';
import { configuration as Configuration } from '../../../../modules/controller.config';
import { events as Events               } from '../../../../modules/controller.events';

@Component({
    selector    : 'views-list',
    templateUrl : './template.html',
})

export class ViewsList {
    @Input() popupGUID : string = '';

    private views : Array<any> = [];

    constructor() {
        this.generateViews();
    }

    generateViews(){
        this.views = Object.keys(Configuration.sets.VIEWS).map((view_id)=>{
            return {
                name        : Configuration.sets.VIEWS[view_id].name,
                description : Configuration.sets.VIEWS[view_id].description,
                icon        : Configuration.sets.VIEWS[view_id].icon,
                handle      : this.addView.bind(this, view_id)
            };
        });
    }

    addView(view_id: string){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.ADD_VIEW, view_id);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.popupGUID);
    }

}

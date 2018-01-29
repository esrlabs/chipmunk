import {ChangeDetectorRef, Component, OnDestroy} from '@angular/core';
import { events as Events                   } from '../../../../modules/controller.events';
import { configuration as Configuration     } from '../../../../modules/controller.config';

@Component({
    selector    : 'progress-bar-global',
    templateUrl : './template.html',
})
export class ProgressBarGlobal implements OnDestroy {

    public visible : boolean = false;

    constructor(private changeDetectorRef   : ChangeDetectorRef) {
        this.onGLOBAL_PROGRESS_SHOW = this.onGLOBAL_PROGRESS_SHOW.bind(this);
        this.onGLOBAL_PROGRESS_HIDE = this.onGLOBAL_PROGRESS_HIDE.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW, this.onGLOBAL_PROGRESS_SHOW);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE, this.onGLOBAL_PROGRESS_HIDE);
    }

    ngOnDestroy(){
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW, this.onGLOBAL_PROGRESS_SHOW);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE, this.onGLOBAL_PROGRESS_HIDE);
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onGLOBAL_PROGRESS_SHOW(){
        this.visible = true;
        this.forceUpdate();
    }

    onGLOBAL_PROGRESS_HIDE(){
        this.visible = false;
        this.forceUpdate();
    }

}

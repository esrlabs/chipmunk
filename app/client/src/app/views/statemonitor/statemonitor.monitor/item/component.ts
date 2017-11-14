import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, EventEmitter, ChangeDetectorRef} from '@angular/core';

import { Indicate, IndicateState                } from './interface';

import { events as Events                       } from '../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../core/modules/controller.config';

class CurrentState{
    css     : string = '';
    icon    : string = '';
    label   : string = '';
    color   : string = '';
}

const BOUND = '__bound';

@Component({
  selector      : 'view-controller-state-monitor-item',
  templateUrl   : './template.html'
})

export class ViewControllerStateMonitorItem implements OnDestroy, OnChanges, AfterContentChecked{
    @Input() indicate   : Indicate = null;

    @Input() update     : EventEmitter<string>;

    public  state       : CurrentState  = null;
    private GUID        : symbol        = Symbol();

    constructor(private changeDetectorRef : ChangeDetectorRef){
        this.changeDetectorRef      = changeDetectorRef;
        this.updateState            = this.updateState.bind(this);
        this.onRESET_ALL_INDICATES  = this.onRESET_ALL_INDICATES.bind(this);
        Events.bind(Configuration.sets.VIEW_STATEMONITOR.IndicateEvents.RESET_ALL_INDICATES, this.onRESET_ALL_INDICATES);
    }

    ngOnDestroy(){
        this.update.unsubscribe();
        delete this.updateState[BOUND];
        Events.unbind(Configuration.sets.VIEW_STATEMONITOR.IndicateEvents.RESET_ALL_INDICATES, this.onRESET_ALL_INDICATES);
    }

    ngAfterContentChecked(){
        this.updateDefaultState();
        if (this.updateState[BOUND] === void 0){
            this.updateState[BOUND] = true;
            this.update.subscribe(this.updateState);
        }
    }

    ngOnChanges(){
    }

    onRESET_ALL_INDICATES(GUID: symbol){
        if (this.GUID !== GUID){
            this.state = null;
            this.updateDefaultState();
            this.forceUpdate();
        }
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    updateState(str: string){
        if (this.indicate !== null && this.indicate.states instanceof Array && this.indicate.states.length > 0){
            let state = null;
            this.indicate.states.forEach((_state)=>{
                if (typeof _state.hook === 'string' && _state.hook !== ''){
                    ~str.indexOf(_state.hook) && (state = _state);
                }
            });
            state !== null && this.applyState(state);
        }
    }

    applyState(state: IndicateState){
        this.getDefaultStateIndex();
        this.state = new CurrentState();
        state.css  !== void 0 && (this.state.css   = state.css);
        state.icon !== void 0 && (this.state.icon  = state.icon);
        state.label!== void 0 && (this.state.label = state.label);
        state.color!== void 0 && (this.state.color = state.color);
        if (typeof state.offInTimeout === 'number'){
            setTimeout(()=>{
                this.state = null;
                this.updateDefaultState();
            }, state.offInTimeout);
        }
        if (state.event instanceof Array){
            state.event.forEach((event)=>{
                Events.trigger(event, this.GUID);

            });
        }
    }

    getDefaultStateIndex(){
        if (this.indicate.defaultState === void 0){
            this.indicate.defaultState = -1;
            this.indicate.states.forEach((state, index)=>{
                state.defaults && (this.indicate.defaultState = index);
            });
        }
    }

    updateDefaultState(){
        this.getDefaultStateIndex();
        if (this.state === null && this.indicate.defaultState !== void 0 && this.indicate.defaultState !== -1){
            let defaults = this.indicate.defaultState;
            if (this.indicate.states[defaults] !== void 0){
                this.state = new CurrentState();
                this.indicate.states[defaults].css  !== void 0 && (this.state.css   = this.indicate.states[defaults].css);
                this.indicate.states[defaults].icon !== void 0 && (this.state.icon  = this.indicate.states[defaults].icon);
                this.indicate.states[defaults].label!== void 0 && (this.state.label = this.indicate.states[defaults].label);
                this.indicate.states[defaults].color!== void 0 && (this.state.color = this.indicate.states[defaults].color);
            }
        } else if (this.state === null){
            this.state = new CurrentState();
            this.indicate.css   !== void 0 && (this.state.css   = this.indicate.css);
            this.indicate.icon  !== void 0 && (this.state.icon  = this.indicate.icon);
            this.indicate.label !== void 0 && (this.state.label = this.indicate.label);
        }
    }

}

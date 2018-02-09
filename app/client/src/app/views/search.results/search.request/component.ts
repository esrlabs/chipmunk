/*global _*/
import { Component, ChangeDetectorRef, AfterContentInit, ViewChild, ViewContainerRef } from '@angular/core';
import { events as Events               } from '../../../core/modules/controller.events';
import { configuration as Configuration } from '../../../core/modules/controller.config';
import { MODES                          } from '../../../core/modules/controller.data.search.modes';
import { DataFilter                     } from '../../../core/interfaces/interface.data.filter';
import { CommonInput                    } from '../../../core/components/common/input/component';

const SETTINGS = {
    TYPING_DELAY : 300 //ms
};

@Component({
    selector    : 'topbar-search-request',
    templateUrl : './template.html',
})
export class TopBarSearchRequest implements AfterContentInit{
    @ViewChild('input') input : CommonInput;

    private value       : string;
    private type        : string;
    private placeholder : string;
    private handles     : Object;
    private delayTimer  : number    = -1;
    private mode        : string    = MODES.REG;
    private autoplay    : boolean   = false;
    private inprogress  : boolean   = false;
    private lastRequest : DataFilter= null;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.value          = '';
        this.placeholder    = 'type your search request';
        this.type           = 'text';
        this.handles        = {
            onFocus     : this.onFocus.     bind(this),
            onBlur      : this.onBlur.      bind(this),
            onKeyDown   : this.onKeyDown.   bind(this),
            onKeyUp     : this.onKeyUp.     bind(this),
            onChange    : this.onChange.    bind(this),
        };
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START,  this.onSEARCH_REQUEST_PROCESS_START.    bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, this.onSEARCH_REQUEST_PROCESS_FINISH.   bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET,          this.onSEARCH_REQUEST_RESET.            bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,        this.onSEARCH_REQUEST_CHANGED.          bind(this));
        Events.bind(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_SEARCH,         this.onSHORTCUT_TO_SEARCH.              bind(this));
    }

    onSHORTCUT_TO_SEARCH(){
        this.input.setFocus();
    }

    ngAfterContentInit(){
        this.input.setFocus();
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
        //this.input.setValue(this.value);
    }

    onFocus(event: Event){
        //this.value = Math.random() + '';
    }

    onBlur(event: Event){
    }

    onKeyDown(event: Event){
    }

    onKeyUp(event: KeyboardEvent){
        if (this.autoplay){
            ~this.delayTimer && clearTimeout(this.delayTimer);
            this.delayTimer = setTimeout(this.trigger_SEARCH_REQUEST_CHANGED.bind(this, event), SETTINGS.TYPING_DELAY);
        } else if (event.keyCode === 13) {
            this.trigger_SEARCH_REQUEST_CHANGED(event);
        }
    }

    onChange(event: Event){
    }

    trigger_SEARCH_REQUEST_CHANGED(event: KeyboardEvent){
        let input : any     = event.target;
        this.value          = input.value;
        this.delayTimer = -1;
        this.triggerSearchRequest();
    }

    triggerSearchRequest(){
        this.onSEARCH_REQUEST_PROCESS_START();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED, (new DataFilter(this.mode, this.value)));
    }

    onModeReg(){
        this.mode = this.mode === MODES.REG ? MODES.TEXT : MODES.REG;
        if (this.value !== '') {
            this.triggerSearchRequest();
        }
    }

    onAutoPlay(){
        this.autoplay = !this.autoplay;
    }

    onAddRequest(){
        this.lastRequest !== null && Events.trigger(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_ACCEPTED, this.lastRequest);
        this.lastRequest = null;
    }

    onSEARCH_REQUEST_PROCESS_START(){
        this.inprogress = true;
        this.forceUpdate();
    }

    onSEARCH_REQUEST_PROCESS_FINISH(){
        this.inprogress = false;
        this.forceUpdate();
    }

    onSEARCH_REQUEST_RESET(){
        this.value = '';
        this.forceUpdate();
    }

    onSEARCH_REQUEST_CHANGED(event: DataFilter){
        this.lastRequest = Object.assign({}, event);
    }
}

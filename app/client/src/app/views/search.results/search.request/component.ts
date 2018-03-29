/*global _*/
import { Component, ChangeDetectorRef, AfterContentInit, ViewChild, ViewContainerRef } from '@angular/core';
import { events as Events               } from '../../../core/modules/controller.events';
import { configuration as Configuration } from '../../../core/modules/controller.config';
import { MODES                          } from '../../../core/modules/controller.data.search.modes';
import { DataFilter                     } from '../../../core/interfaces/interface.data.filter';
import { CommonInput                    } from '../../../core/components/common/input/component';
import { ExtraButton, BarAPI            } from './interface.extrabutton';

const SETTINGS = {
    TYPING_DELAY : 300 //ms
};

const DEFAULTS = {
    PLACEHOLDER: 'type your search request'
};

@Component({
    selector    : 'topbar-search-request',
    templateUrl : './template.html',
})

export class TopBarSearchRequest implements AfterContentInit{
    @ViewChild('input') input : CommonInput;

    private value               : string;
    private type                : string;
    private placeholder         : string;
    private handles             : Object;
    private delayTimer          : number                = -1;
    private mode                : string                = MODES.REG;
    private autoplay            : boolean               = false;
    private inprogress          : boolean               = false;
    private lastRequest         : DataFilter            = null;
    private extraButtons        : Array<ExtraButton>    = [];

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.value          = '';
        this.placeholder    = DEFAULTS.PLACEHOLDER;
        this.type           = 'text';
        this.handles        = {
            onFocus     : this.onFocus.     bind(this),
            onBlur      : this.onBlur.      bind(this),
            onKeyDown   : this.onKeyDown.   bind(this),
            onKeyUp     : this.onKeyUp.     bind(this),
            onChange    : this.onChange.    bind(this),
        };
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START,      this.onSEARCH_REQUEST_PROCESS_START.        bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH,     this.onSEARCH_REQUEST_PROCESS_FINISH.       bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET,              this.onSEARCH_REQUEST_RESET.                bind(this));
        Events.bind(Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,            this.onSEARCH_REQUEST_CHANGED.              bind(this));
        Events.bind(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_SEARCH,             this.onSHORTCUT_TO_SEARCH.                  bind(this));
        Events.bind(Configuration.sets.EVENTS_VIEWS.VIEW_SEARCH_RESULTS_BUTTON_ADD,     this.onVIEW_SEARCH_RESULTS_BUTTON_ADD.      bind(this));
        Events.bind(Configuration.sets.EVENTS_VIEWS.VIEW_SEARCH_RESULTS_BUTTON_REMOVE,  this.onVIEW_SEARCH_RESULTS_BUTTON_REMOVE.   bind(this));
    }

    onSHORTCUT_TO_SEARCH(){
        this.input.setFocus();
    }

    ngAfterContentInit(){
        this.input.setFocus();
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onFocus(event: Event){
        //this.value = Math.random() + '';
    }

    onBlur(event: Event){
    }

    onKeyDown(event: Event){
    }

    onKeyUp(event: KeyboardEvent){
        let extraButton = this.getActiveExtraButton();
        if (extraButton === null) {
            if (this.autoplay){
                ~this.delayTimer && clearTimeout(this.delayTimer);
                this.delayTimer = setTimeout(this.trigger_SEARCH_REQUEST_CHANGED.bind(this, event), SETTINGS.TYPING_DELAY);
            } else if (event.keyCode === 13) {
                this.trigger_SEARCH_REQUEST_CHANGED(event);
            } else {
                this.lastRequest = null;
            }
        } else {
            if (event.keyCode === 13) {
                return extraButton.onEnter(event, this.input.getValue());
            }
            extraButton.onKeyUp(event, this.input.getValue());
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
        if (event.value === '') {
            this.lastRequest = null;
        } else {
            this.lastRequest = Object.assign({}, event);
        }
    }

    resetInput(){
        this.value = '';
        this.input.setValue('');
        this.lastRequest = null;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Extra buttons functionality
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    getAPI(id: string | symbol): BarAPI{
        return {
            setValue: this.valueSetter.bind(this, id),
            setState: this.stateSetter.bind(this, id),
            showProgress: this.progressShow.bind(this, id),
            hideProgress: this.progressHide.bind(this, id),
            disable: () => {},
            enable: () => {}
        }
    }

    isValidButton(id: string | symbol){
        return ~this.getExtraButtonByID(id).index ? true : false;
    }

    valueSetter(id: string | symbol, value: string){
        if (!this.isValidButton(id)){
            return false;
        }
        this.input.setValue(value);
    }

    stateSetter(id: string | symbol, state: boolean){
        let button = this.getExtraButtonByID(id);
        if (!~button.index){
            return false;
        }
        this.extraButtons[button.index].active = state;
    }

    progressShow(id: string | symbol){
        if (!this.isValidButton(id)) {
            return false;
        }
        this.inprogress = true;
        this.forceUpdate();
    }

    progressHide(id: string | symbol){
        if (!this.isValidButton(id)){
            return false;
        }
        this.inprogress = false;
        this.forceUpdate();
    }

    onExtraButtonClick(event: MouseEvent, id: string | symbol){
        let button = this.getExtraButtonByID(id);
        if (!~button.index){
            return false;
        }
        this.extraButtons[button.index].active = !this.extraButtons[button.index].active;
        if (this.extraButtons[button.index].active){
            this.placeholder = this.extraButtons[button.index].placeholder;
        } else {
            this.placeholder = DEFAULTS.PLACEHOLDER;
        }
        this.progressHide(id);
        this.resetInput();
        this.forceUpdate();
    }

    getExtraButtonByID(id: string | symbol){
        let result : {
            button: ExtraButton | null,
            index: number
        } = {
            button: null,
            index: -1
        };
        this.extraButtons.forEach((button, index) => {
            if (button.id === id) {
                result.button = button;
                result.index = index;
            }
        });
        return result;
    }

    getActiveExtraButton(): ExtraButton | null{
        let result = null;
        this.extraButtons.forEach((button, index) => {
            button.active && (result = button);
        });
        return result;
    }

    onVIEW_SEARCH_RESULTS_BUTTON_ADD(button: ExtraButton, callback: Function){
        if (~this.getExtraButtonByID(button.id).index) {
            return false;
        }
        this.extraButtons.push(button);
        typeof callback === 'function' && callback(this.getAPI(button.id));
    }

    onVIEW_SEARCH_RESULTS_BUTTON_REMOVE(id: string | symbol){
        let index = this.getExtraButtonByID(id).index;
        if (!~index) {
            return false;
        }
        this.extraButtons.splice(index, 1);
        if (this.getActiveExtraButton() === null){
            this.progressHide(id);
            this.placeholder = DEFAULTS.PLACEHOLDER;
        }
    }
}

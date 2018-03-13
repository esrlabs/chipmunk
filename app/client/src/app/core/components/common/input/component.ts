import {Component, EventEmitter, Input, Output, ViewChild, ViewContainerRef, ChangeDetectorRef} from '@angular/core';
import { configuration as Configuration } from '../../../modules/controller.config';
import { events as Events               } from '../../../modules/controller.events';

const EVENTS = {
    onFocus     : 'onFocus',
    onBlur      : 'onBlur',
    onKeyDown   : 'onKeyDown',
    onKeyUp     : 'onKeyUp',
    onChange    : 'onChange'
};

@Component({
    selector    : 'common-input',
    templateUrl : './template.html',
})
export class CommonInput {
    @Input() value          : string = '';
    @Input() type           : string = 'text';
    @Input() placeholder    : string = '';
    @Input() handles        : Object = {};

    @Output() onEnter       : EventEmitter<any> = new EventEmitter();

    @ViewChild ('input', { read: ViewContainerRef}) input: ViewContainerRef;

    private disabled: boolean   = false;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
    }

    @Output() getValue(){
        return this.input.element.nativeElement.value;
    }

    @Output() setValue(value: string){
        this.input.element.nativeElement.value  = value;
        //this.value = value;
        this.forceUpdate();
    }

    @Output() setFocus(){
        return this.input.element.nativeElement.focus();
    }

    @Output() forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    @Output() disable(){
        this.disabled = true;
        this.forceUpdate();
    }

    @Output() enable(){
        this.disabled = false;
        this.forceUpdate();
    }

    handle(name: string, event: Event){
        typeof this.handles[name] === 'function' && this.handles[name](event, this.input.element.nativeElement.value);
    }

    onFocus(event: Event){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON);
        this.handle(EVENTS.onFocus, event);
    }

    onBlur(event: Event){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF);
        this.handle(EVENTS.onBlur, event);
    }

    onKeyDown(event: KeyboardEvent){
        this.handle(EVENTS.onKeyDown, event);
    }

    onKeyUp(event: KeyboardEvent){
        this.handle(EVENTS.onKeyUp, event);
        event.keyCode === 13 && this.onEnter.emit();
    }

    onChange(event: Event){
        this.handle(EVENTS.onChange, event);
    }
}

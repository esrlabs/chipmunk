import {Component, EventEmitter, Input, Output, ViewChild, ViewContainerRef, ChangeDetectorRef, AfterViewChecked} from '@angular/core';
import { configuration as Configuration } from '../../../modules/controller.config';
import { events as Events               } from '../../../modules/controller.events';
import {DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { clearHTML } from '../../../modules/tools.htmlserialize';

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
export class CommonInput implements AfterViewChecked {
    @Input() value          : string    = '';
    @Input() type           : string    = 'text';
    @Input() placeholder    : string    = '';
    @Input() handles        : Object    = {};
    @Input() autoFocus      : boolean   = false;
    @Input() preventUpDown  : boolean   = false;


    @Output() onEnter       : EventEmitter<KeyboardEvent> = new EventEmitter();
    @Output() onLeft        : EventEmitter<KeyboardEvent> = new EventEmitter();
    @Output() onRight       : EventEmitter<KeyboardEvent> = new EventEmitter();
    @Output() onUp          : EventEmitter<KeyboardEvent> = new EventEmitter();
    @Output() onDown        : EventEmitter<KeyboardEvent> = new EventEmitter();

    @ViewChild ('input', { read: ViewContainerRef}) input: ViewContainerRef;
    @ViewChild ('inputmeasure', { read: ViewContainerRef}) inputmeasure: ViewContainerRef;

    private disabled: boolean = false;
    private focused: boolean = false;
    private highlight: SafeHtml = null;
    private highlightOffset: number = 0;
    private _value: string = '';

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private sanitizer           : DomSanitizer) {
    }

    ngAfterViewChecked(){
        if (!this.focused && this.autoFocus && this.input !== null){
            this.input.element.nativeElement.focus();
            this.focused = true;
        }
        if (this.input !== null){
            this.updateHighlightIfNeed();
        }
    }

    @Output() getValue(){
        return this.input.element.nativeElement.value;
    }

    @Output() setValue(value: string){
        this.input.element.nativeElement.value = value;
        this.updateValueProp();
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

    @Output() setCursorToEnd(){
        const length = this.input.element.nativeElement.value.length;
        this.input.element.nativeElement.selectionEnd = length;
        this.input.element.nativeElement.selectionStart = length;
        this.forceUpdate();
    }

    @Output() setCursorToBegin(){
        this.input.element.nativeElement.selectionEnd = 0;
        this.input.element.nativeElement.selectionStart = 0;
        this.forceUpdate();
    }

    @Output() getCursorPosition(){
        return this.input.element.nativeElement.selectionEnd;
    }

    handle(name: string, event: Event, value: string = null){
        typeof this.handles[name] === 'function' && this.handles[name](event, value === null ? this.input.element.nativeElement.value : value);
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
        if (event.key.length === 1) {
            const newValue = this.getValue() + event.key;
            this.updateValueProp();
            this.updateHighlight();
            return this.handle(EVENTS.onKeyDown, event, newValue);
        }
        this.handle(EVENTS.onKeyDown, event);
        event.keyCode === 37 && this.onLeft.emit(event);
        event.keyCode === 38 && this.onUp.emit(event);
        event.keyCode === 39 && this.onRight.emit(event);
        event.keyCode === 40 && this.onDown.emit(event);
        if (this.preventUpDown && event.keyCode === 38 || event.keyCode === 40) {
            event.preventDefault();
            return false;
        }
    }

    onKeyUp(event: KeyboardEvent){
        this.updateValueProp();
        this.updateHighlight();
        this.handle(EVENTS.onKeyUp, event);
        event.keyCode === 13 && this.onEnter.emit(event);
    }

    onChange(event: Event){
        this.handle(EVENTS.onChange, event);
    }

    updateValueProp(value: string = null){
        value = typeof value !== 'string' ? this.input.element.nativeElement.value : value;
        this._value = value.replace(/\s/gi, '.');
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Highlight
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    @Output() setHighlight(value: string){
        if (typeof value !== 'string') {
            return;
        }
        this.highlight = this.sanitizer.bypassSecurityTrustHtml(clearHTML(value.trim() === '' ? '' : value));
        this.updateValueProp();
        this.updateHighlight();
    }

    @Output() getHighlightOffset(){
        return this.getCursorXPosition();
    }

    getCursorXPosition(): number{
        const input = this.input.element.nativeElement;
        if (this.inputmeasure === null) {
            return 0;
        }
        const size = this.inputmeasure.element.nativeElement.getBoundingClientRect();
        return size.width + 4;
    }

    updateHighlight(){
        this.highlightOffset = this.getCursorXPosition();
        this.forceUpdate();
    }

    updateHighlightIfNeed(){
        if (this.highlightOffset === this.getCursorXPosition()) {
            return;
        }
        this.updateHighlight();
    }
}

import { EventEmitter                           } from '@angular/core';
import { ClipboardShortcuts, ClipboardKeysEvent } from './controller.clipboard.shortcuts';

const EVENTS = {
    mousedown   : 'mousedown',
    mouseup     : 'mouseup'
};

class TextSelection {

    private inProgress          : boolean               = false;
    private trigger             : EventEmitter<string>  = null;
    private target              : HTMLElement           = null;
    private clipboardShortcuts  : ClipboardShortcuts    = new ClipboardShortcuts();

    constructor(target: HTMLElement, trigger : EventEmitter<string>){
        if (target){
            if (target.addEventListener !== void 0){
                this[EVENTS.mousedown   ] = this[EVENTS.mousedown   ].bind(this);
                this[EVENTS.mouseup     ] = this[EVENTS.mouseup     ].bind(this);
                this.windowMouseUpListener = this.windowMouseUpListener.bind(this);
                target.addEventListener(EVENTS.mousedown,   this[EVENTS.mousedown]);
                target.addEventListener(EVENTS.mouseup,     this[EVENTS.mouseup]);
                this.trigger = trigger;
                this.target  = target;
                this.clipboardShortcuts.onCopy.subscribe(this.onCopy.bind(this));
                this.clipboardShortcuts.onPaste.subscribe(this.onPaste.bind(this));
            }
        }
    }

    destroy(){
        this.clipboardShortcuts.onCopy.unsubscribe();
        this.clipboardShortcuts.onPaste.unsubscribe();
        this.clipboardShortcuts.destroy();
        this.target.removeEventListener(EVENTS.mousedown,   this[EVENTS.mousedown]);
        this.target.removeEventListener(EVENTS.mouseup,     this[EVENTS.mouseup]);
        this.unbindWindowListener();
    }

    bindWindowListener(){
        window.addEventListener(EVENTS.mouseup, this.windowMouseUpListener);
    }

    unbindWindowListener(){
        window.removeEventListener(EVENTS.mouseup, this.windowMouseUpListener);
    }

    windowMouseUpListener(event?: MouseEvent){
        this.unbindWindowListener();
        this.inProgress = false;
    }

    onCopy(event: ClipboardKeysEvent) {
        const text  = typeof event.selection.toString === 'function' ? event.selection.toString() : null;
        const reg   = /\u0020/gi;
        const searchReg = /^\d*\u0020/gim;

        if (text === null) {
            return false;
        }

        if (!~text.search(searchReg)){
            return false;
        }

        const element           = document.createElement('P');
        element.style.opacity   = '0.0001';
        element.style.position  = 'absolute';
        element.style.width     = '1px';
        element.style.height    = '1px';
        element.style.overflow  = 'hidden';
        element.innerHTML       = text.replace(searchReg, '').replace(/\r?\n|\r/gi, '</br>');
        document.body.appendChild(element);
        const range             = document.createRange();
        range.selectNode(element);
        event.selection.empty();
        event.selection.addRange(range);

        this.clipboardShortcuts.doCopy();

        event.selection.empty();
        document.body.removeChild(element);
    }

    onPaste() {

    }

    [EVENTS.mousedown] (event: MouseEvent){
        this.bindWindowListener();
        this.inProgress = true;
    }

    [EVENTS.mouseup] (event: MouseEvent){
        let selection = window.getSelection();
        if (typeof selection.toString === 'function'){
            this.trigger.emit(selection.toString());
        }
    }

}

export { TextSelection };
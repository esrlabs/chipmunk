import { EventEmitter } from '@angular/core';

const EVENTS = {
    mousedown   : 'mousedown',
    mouseup     : 'mouseup'
};

class TextSelection {

    private inProgress  : boolean               = false;
    private trigger     : EventEmitter<string>  = null;

    constructor(target: HTMLElement, trigger : EventEmitter<string>){
        if (target){
            if (target.addEventListener !== void 0){
                this[EVENTS.mousedown   ] = this[EVENTS.mousedown   ].bind(this);
                this[EVENTS.mouseup     ] = this[EVENTS.mouseup     ].bind(this);
                this.windowMouseUpListener = this.windowMouseUpListener.bind(this);
                target.addEventListener(EVENTS.mousedown,   this[EVENTS.mousedown]);
                target.addEventListener(EVENTS.mouseup,     this[EVENTS.mouseup]);
                this.trigger = trigger;
            }
        }
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

    [EVENTS.mousedown] (event: MouseEvent){
        this.bindWindowListener();
        this.inProgress = true;
    }

    [EVENTS.mouseup] (event: MouseEvent){
        let selection   = window.getSelection(),
            text        = '';
        if (typeof selection.toString === 'function'){
            this.trigger.emit(selection.toString());
        }
    }

}

export { TextSelection };
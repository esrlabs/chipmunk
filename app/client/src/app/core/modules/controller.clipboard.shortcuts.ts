import { EventEmitter                   } from '@angular/core';
import {configuration as Configuration  } from "./controller.config";
import {events as Events                } from "./controller.events";

const EVENTS = {
    keydown : 'keydown',
    paste   : 'paste'
};

type ClipboardKeysEvent = {
    event       : KeyboardEvent | ClipboardEvent,
    selection?  : Selection,
    text?       : string
};

class ClipboardShortcuts {

    public onCopy       : EventEmitter<ClipboardKeysEvent>   = new EventEmitter();
    public onPaste      : EventEmitter<ClipboardKeysEvent>   = new EventEmitter();

    private silence     : boolean   = false;

    constructor(){
        [   Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON,
            Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF
        ].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.onKeyDown  = this.onKeyDown.bind(this);
        this.onWinPaste = this.onWinPaste.bind(this);
        document.addEventListener(EVENTS.keydown,   this.onKeyDown);
        document.addEventListener(EVENTS.paste,     this.onWinPaste);
    }

    destroy(){
        [   Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON,
            Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF
        ].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        document.removeEventListener(EVENTS.keydown,    this.onKeyDown);
        document.removeEventListener(EVENTS.paste,      this.onWinPaste);
    }

    private onKeyDown(event: KeyboardEvent){
        if (this.silence || event.key === '') {
            return false;
        }
        if ((event.ctrlKey || event.metaKey) && ~['C', 'c'].indexOf(event.key)){
            return this.onCopy.emit({ event: event, selection: window.getSelection()});
        }
        if ((event.ctrlKey || event.metaKey) && ~['X', 'x'].indexOf(event.key)){
            return this.onCopy.emit({ event: event, selection: window.getSelection()});
        }
    }

    public doCopy(){
        document.execCommand('copy');
    }

    public doPaste(){
        document.execCommand('paste');
    }

    private onSHORTCUTS_SILENCE_OFF(){
        this.silence = false;
    }

    private onSHORTCUTS_SILENCE_ON(){
        this.silence = true;
    }

    private onWinPaste(event: ClipboardEvent){
        return !this.silence  ? this.onPaste.emit({ event: event, text: event.clipboardData.getData('text') }) : false;
    }

}

//const clipboardShortcuts = new ClipboardShortcuts();

export { ClipboardShortcuts, ClipboardKeysEvent };
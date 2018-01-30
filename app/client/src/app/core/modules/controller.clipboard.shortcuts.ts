import { EventEmitter } from '@angular/core';

const EVENTS = {
    keydown: 'keydown'
};

type ClipboardKeysEvent = {
    event       : KeyboardEvent,
    selection?  : Selection
};

class ClipboardShortcuts {

    public onCopy       : EventEmitter<ClipboardKeysEvent>   = new EventEmitter();
    public onPaste      : EventEmitter<ClipboardKeysEvent>   = new EventEmitter();

    constructor(){
        document.addEventListener(EVENTS.keydown, this.onKeyDown.bind(this));
    }

    private onKeyDown(event: KeyboardEvent){
        if (event.key === '') {
            return false;
        }
        if ((event.ctrlKey || event.metaKey) && ~['C', 'c'].indexOf(event.key)){
            return this.onCopy.emit({ event: event, selection: window.getSelection()});
        }
        if ((event.ctrlKey || event.metaKey) && ~['X', 'x'].indexOf(event.key)){
            return this.onCopy.emit({ event: event, selection: window.getSelection()});
        }
        if ((event.ctrlKey || event.metaKey) && ~['V', 'v'].indexOf(event.key)){
            return this.onPaste.emit({ event: event });
        }
    }

    public doCopy(){
        document.execCommand('copy');
    }

    public doPaste(){
        document.execCommand('paste');
    }

}

const clipboardShortcuts = new ClipboardShortcuts();

export { clipboardShortcuts, ClipboardKeysEvent };
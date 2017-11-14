import { EventEmitter } from '@angular/core';

interface HistoryItem {
    time    : string;
    value   : string;
    usage   : number;
    stamp   : number;
    match   : boolean;
    selected: boolean;
}

interface HistoryItemWrapper {
    item        : HistoryItem;
    onChange    : EventEmitter<HistoryItem>;
    onTyping    : EventEmitter<string>;
    onRemove    : Function;
    onSelect    : Function;
}


export { HistoryItem, HistoryItemWrapper };
import { EventEmitter } from '@angular/core';

interface Tab {
    id          : symbol | string,
    label       : string,
    onSelect    : EventEmitter<any>,
    onDeselect  : EventEmitter<any>,
    onResize    : EventEmitter<any>,
    setLabel?   : EventEmitter<any>,
    factory     : any,
    params      : Object,
    update?     : Function,
    active?     : boolean
}

export { Tab };
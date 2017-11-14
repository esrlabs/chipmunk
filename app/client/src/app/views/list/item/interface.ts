import { EventEmitter } from '@angular/core';

interface ListItemInterface{
    selected    : EventEmitter<number>,
    bookmark    : EventEmitter<number>,
    update      : Function
}

export { ListItemInterface }

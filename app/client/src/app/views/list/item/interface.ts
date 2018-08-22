import { EventEmitter } from '@angular/core';
import { TRemarkSelection } from './component';

interface ListItemInterface{
    selected    : EventEmitter<number>,
    bookmark    : EventEmitter<number>,
    remark      : EventEmitter<TRemarkSelection>,
    update      : Function
}

export { ListItemInterface }

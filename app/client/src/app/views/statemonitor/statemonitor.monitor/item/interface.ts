import { EventEmitter } from '@angular/core';

interface IndicateState{
    hook            : string;
    icon?           : string;
    label?          : string;
    css?            : string;
    color?          : string;
    offInTimeout?   : number;
    event?          : Array<string>;
    defaults        : boolean;
}

interface Indicate{
    name            : string;
    icon?           : string;
    css?            : string;
    label?          : string;
    description?    : string;
    states          : Array<IndicateState>;
    defaultState?   : number,
    updateState?    : EventEmitter<string>
}

export { Indicate, IndicateState };
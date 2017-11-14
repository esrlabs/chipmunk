import {Component, Input    } from '@angular/core';

interface ThemeItem {
    name: string,
    file: string
}
@Component({
    selector    : 'dialog-themes-list',
    templateUrl : './template.html',
})

export class DialogThemesList {
    @Input() themes     : Array<ThemeItem>  = [];
    @Input() handler    : Function          = null;

    constructor() {
    }

    onSelect(file: string){
        typeof this.handler === 'function' && this.handler(file);
    }

}

import {Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';

@Component({
    selector    : 'common-simple-table',
    templateUrl : './template.html',
})
export class CommonSimpleTable {
    @Input() rows           : Array<Array<string>>  = [];
    @Input() columns        : Array<string>         = [];
    @Input() cssClasses     : {
        column  : string,
        row     : string
    } = {
        column  : '',
        row     : ''
    };

    @Output() onSelect      : EventEmitter<number> = new EventEmitter();

    @Output() forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    private selected: number = -1;

    constructor(private changeDetectorRef : ChangeDetectorRef) {
    }

    onSelectRow(index: number){
        this.selected = this.selected === index ? -1 : index;
        this.onSelect.emit(this.selected);
    }
}

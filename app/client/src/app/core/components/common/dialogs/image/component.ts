import {Component, Input, ChangeDetectorRef } from '@angular/core';

@Component({
    selector    : 'image-dialog',
    templateUrl : './template.html',
})

export class ImageDialog {
    @Input() url : string = '';

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

}

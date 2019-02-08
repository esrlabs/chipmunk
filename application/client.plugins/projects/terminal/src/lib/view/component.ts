import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';

@Component({
    selector: 'lib-view-component',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewComponent implements AfterViewInit {

    @Input() public history: string[];

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {

    }


}

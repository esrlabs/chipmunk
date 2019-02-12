import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DockDef } from '../service';

@Component({
    selector: 'lib-complex-docking-dock',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DockComponent implements AfterViewInit, OnDestroy {

    @Input() public dock: DockDef.IDock;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {

    }

    ngAfterViewInit() {

    }

}

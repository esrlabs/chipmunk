import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from '../../state';

@Component({
    selector: 'app-layout-area-primary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimiryAreaControlsComponent implements AfterViewInit, OnDestroy {

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {

    }

    ngOnDestroy() {

    }

    private _ng_onStateToggle(event: MouseEvent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
    }

}

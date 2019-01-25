import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from '../../state';

@Component({
    selector: 'app-layout-area-secondary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutSecondaryAreaControlsComponent implements AfterViewInit, OnDestroy {

    @Input() public state: AreaState;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {

    }

    ngOnDestroy() {

    }

    private _ng_onStateToggle() {
        if (this.state.minimized) {
            this.state.maximize();
        } else {
            this.state.minimize();
        }
    }

}

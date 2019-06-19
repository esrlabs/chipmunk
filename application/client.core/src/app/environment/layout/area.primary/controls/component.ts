import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from '../../state';

@Component({
    selector: 'app-layout-area-primary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimiryAreaControlsComponent implements AfterViewInit, OnDestroy {

    @Input() public onNewTab: () => void;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {

    }

    ngOnDestroy() {

    }

    private _ng_onAddNew(event: MouseEvent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof this.onNewTab !== 'function') {
            return false;
        }
        this.onNewTab();
        return false;
    }

}

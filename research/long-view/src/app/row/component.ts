// tslint:disable-next-line:max-line-length
import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Observable } from 'rxjs';


@Component({
    selector: 'app-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class RowComponent implements AfterContentInit {

    @Input() public row: string | undefined;
    @Input() public index: number | undefined;


    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngAfterContentInit() {
        this._cdRef.detectChanges();
    }

    public _ng_getStyle(): { [key: string]: any } {
        if (this.row !== undefined) {
            return {};
        } else {
            return { width: `${Math.random() * 25 + 70}%` };
        }
    }

}

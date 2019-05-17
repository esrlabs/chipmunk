// tslint:disable-next-line:max-line-length
import { Component, ChangeDetectorRef, ViewContainerRef, Input, AfterContentInit, OnChanges } from '@angular/core';


@Component({
    selector: 'app-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class RowComponent implements AfterContentInit, OnChanges {

    @Input() public row: string | undefined;
    @Input() public index: number | undefined;


    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngOnChanges() {
        this._cdRef.detectChanges();
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

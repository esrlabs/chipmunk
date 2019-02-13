import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';

@Component({
    selector: 'lib-view',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewComponent implements AfterViewInit, OnDestroy {

    @Input() public title: string;

    private _timer: any = -1;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {
        clearTimeout(this._timer);
    }

    ngAfterViewInit() {
        this._next();
    }

    private _next() {
        this._timer = setTimeout(() => {
            this.title = Math.random() + '';
            this._next();
        }, 500);
    }


}

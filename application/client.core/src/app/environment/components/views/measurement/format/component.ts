import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { IFormat } from '../../../../controller/controller.session.tab.timestamp';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement-format',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementFormatComponent implements AfterViewInit, AfterContentInit, OnDestroy {

    @Input() format: IFormat;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementFormatComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterContentInit() {
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

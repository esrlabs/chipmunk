// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { IOptions, COptionsLabes } from '../../../common/interface.options';
import * as Toolkit from 'chipmunk.client.toolkit';


@Component({
    selector: 'lib-sb-port-options-read-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalPortOptionsReadComponent implements AfterViewInit, OnDestroy {

    @Input() public options: IOptions;

    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _destroyed: boolean = false;

    public _ng_options: Array<{ key: string, value: string }> = [];

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        if (this.options === undefined || this.options === null) {
            return;
        }
        Object.keys(this.options.options).forEach((key: string) => {
            this._ng_options.push({
                key: COptionsLabes[key] !== undefined ? COptionsLabes[key] : key,
                value: this.options.options[key]
            });
        });
        Object.keys(this.options.reader).forEach((key: string) => {
            this._ng_options.push({
                key: COptionsLabes[key] !== undefined ? COptionsLabes[key] : key,
                value: this.options.reader[key]
            });
        });
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

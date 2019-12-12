// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, OnChanges, SimpleChanges, SimpleChange } from '@angular/core';
import { IPortInfo, IPortState, IIOState } from '../../../common/interface.portinfo';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'lib-sb-portinfo-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalPortInfoComponent implements AfterViewInit, OnDestroy, OnChanges {

    @Input() public port: IPortInfo;
    @Input() public state: IPortState;

    public _ng_more: Array<{ name: string, value: string}> = [];
    public _ng_read: string = '';

    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _destroyed: boolean = false;
    private _more: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        if (this.port === undefined || this.port === null) {
            return;
        }
        Object.keys(this.port).forEach((key: string) => {
            if (key === 'path') {
                return;
            }
            if (this.port[key] === undefined && this.port[key] === null) {
                return;
            }
            this._ng_more.push({ name: key, value: this.port[key] });
        });
        this._forceUpdate();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.state !== undefined) {
            this.state = changes.state.currentValue;
            this._updateSize();
        }
    }

    public _ng_isMoreOpened(): boolean {
        return this._more;
    }

    public _ng_onMore(event: MouseEvent) {
        this._more = !this._more;
        event.stopImmediatePropagation();
        event.preventDefault();
        this._forceUpdate();
    }

    private _updateSize() {
        let read: string = '';
        if (this.state.ioState.read === 0) {
            read = '';
        } else if (this.state.ioState.read > 1024 * 1024 * 1024) {
            read = (this.state.ioState.read / 1024 / 1024 / 1024).toFixed(2) + ' Gb';
        } else if (this.state.ioState.read > 1024 * 1024) {
            read = (this.state.ioState.read / 1024 / 1024).toFixed(2) + ' Mb';
        } else if (this.state.ioState.read > 1024) {
            read = (this.state.ioState.read / 1024).toFixed(2) + ' Kb';
        } else {
            read = this.state.ioState.read + ' b';
        }
        this._ng_read = read;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

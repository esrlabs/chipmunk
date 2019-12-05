// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, OnChanges, SimpleChanges, SimpleChange } from '@angular/core';
import { IPortInfo, IPortState, IIOState } from '../../../common/interface.portinfo';
import { IOptions } from '../../../common/interface.options';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'lib-sb-port-connected-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalPortConnectedComponent implements AfterViewInit, OnDestroy, OnChanges {

    @Input() public port: IPortInfo;
    @Input() public options: IOptions;
    @Input() public state: IPortState;
    @Input() public onDisconnect: () => void;

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
        this._updateSize();
        this._forceUpdate();
    }

    ngOnChanges(changes: SimpleChanges) {
        this._updateSize();
        if (changes.state !== undefined) {
            this.state = changes.state.currentValue;
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

    public _ng_onDisconnect() {
        this.onDisconnect();
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

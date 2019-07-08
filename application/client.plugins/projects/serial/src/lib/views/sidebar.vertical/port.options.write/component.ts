// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ViewChild } from '@angular/core';
import { IOptions } from '../../../common/interface.options';
import * as Toolkit from 'logviewer.client.toolkit';
import { CheckSimpleComponent, InputStandardComponent, DDListStandardComponent } from 'logviewer-client-primitive';

@Component({
    selector: 'lib-sb-port-options-write-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalPortOptionsWriteComponent implements AfterViewInit, OnDestroy {

    @ViewChild('baudRateCom') _baudRateCom: DDListStandardComponent;
    @ViewChild('lockCom') _lockCom: CheckSimpleComponent;
    @ViewChild('dataBitsCom') _dataBitsCom: DDListStandardComponent;
    @ViewChild('highWaterMarkCom') _highWaterMarkCom: InputStandardComponent;
    @ViewChild('stopBitsCom') _stopBitsCom: DDListStandardComponent;
    @ViewChild('parityCom') _parityCom: DDListStandardComponent;
    @ViewChild('rtsctsCom') _rtsctsCom: CheckSimpleComponent;
    @ViewChild('xonCom') _xonCom: CheckSimpleComponent;
    @ViewChild('xoffCom') _xoffCom: CheckSimpleComponent;
    @ViewChild('xanyCom') _xanyCom: CheckSimpleComponent;
    @ViewChild('encodingCom') _encodingCom: DDListStandardComponent;

    @Input() public baudRate: number = 9600;
    @Input() public lock: boolean = false;
    @Input() public dataBits: number = 8;
    @Input() public highWaterMark: number = 65536;
    @Input() public stopBits: number = 1;
    @Input() public parity: string = 'none';
    @Input() public rtscts: boolean = false;
    @Input() public xon: boolean = false;
    @Input() public xoff: boolean = false;
    @Input() public xany: boolean = false;
    @Input() public delimiter: string = '\n';
    @Input() public encoding: string = 'utf8';
    @Input() public includeDelimiter: boolean = false;
    @Input() public path: string;

    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _destroyed: boolean = false;

    public _ng_baudrateItems: Array<{ caption: string, value: any, }> = [
        { caption: '110', value: 110 },
        { caption: '300', value: 300 },
        { caption: '1200', value: 1200 },
        { caption: '2400', value: 2400 },
        { caption: '4800', value: 4800 },
        { caption: '9600', value: 9600 },
        { caption: '14400', value: 14400 },
        { caption: '19200', value: 19200 },
        { caption: '38400', value: 38400 },
        { caption: '57600', value: 57600 },
        { caption: '115200', value: 115200 },
    ];
    public _ng_databitsItems: Array<{ caption: string, value: any, }> = [
        { caption: '8', value: 8 },
        { caption: '7', value: 7 },
        { caption: '6', value: 6 },
        { caption: '5', value: 5 },
    ];
    public _ng_stopbitsItems: Array<{ caption: string, value: any, }> = [
        { caption: '1', value: 1 },
        { caption: '2', value: 2 },
    ];
    public _ng_parityItems: Array<{ caption: string, value: any, }> = [
        { caption: 'none', value: 'none' },
        { caption: 'even', value: 'even' },
        { caption: 'mark', value: 'mark' },
        { caption: 'odd', value: 'odd' },
        { caption: 'space', value: 'space' },
    ];
    public _ng_encodingItems: Array<{ caption: string, value: any, }> = [
        { caption: 'ascii', value: 'ascii' },
        { caption: 'utf8', value: 'utf8' },
        { caption: 'utf16le', value: 'utf16le' },
        { caption: 'ucs2', value: 'ucs2' },
        { caption: 'base64', value: 'base64' },
        { caption: 'binary', value: 'binary' },
        { caption: 'hex', value: 'hex' },
        { caption: 'undefined', value: undefined },
    ];

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        this._forceUpdate();
    }

    public getOptions(): IOptions {
        return {
            path: this.path,
            options: {
                baudRate: this._baudRateCom.getValue(),
                lock: this._lockCom.getValue(),
                parity: this._parityCom.getValue(),
                dataBits: this._dataBitsCom.getValue(),
                xany: this._xanyCom.getValue(),
                xoff: this._xoffCom.getValue(),
                xon: this._xonCom.getValue(),
                rtscts: this._rtsctsCom.getValue(),
                highWaterMark: this._highWaterMarkCom.getValue() as number,
                stopBits: this._stopBitsCom.getValue(),
            },
            reader: {
                encoding: this._encodingCom.getValue(),
                delimiter: '\n',
                includeDelimiter: false
            }
        };
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

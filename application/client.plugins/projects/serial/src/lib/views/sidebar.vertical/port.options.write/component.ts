// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit, Input, ViewChild } from '@angular/core';
import { IOptions } from '../../../common/interface.options';
import * as Toolkit from 'chipmunk.client.toolkit';
import { CheckSimpleComponent, InputStandardComponent, DDListStandardComponent } from 'chipmunk-client-material';

@Component({
    selector: 'lib-sb-port-options-write-com',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalPortOptionsWriteComponent implements AfterViewInit, AfterContentInit, OnDestroy {

    @ViewChild('baudRateInputCom', {static: false}) _baudRateInputCom: InputStandardComponent;
    @ViewChild('baudRateDDCom', {static: false}) _baudRateDDCom: DDListStandardComponent;
    @ViewChild('lockCom', {static: false}) _lockCom: CheckSimpleComponent;
    @ViewChild('dataBitsCom', {static: false}) _dataBitsCom: DDListStandardComponent;
    @ViewChild('highWaterMarkCom', {static: false}) _highWaterMarkCom: InputStandardComponent;
    @ViewChild('delimiterCom', {static: false}) _delimiterCom: InputStandardComponent;
    @ViewChild('stopBitsCom', {static: false}) _stopBitsCom: DDListStandardComponent;
    @ViewChild('parityCom', {static: false}) _parityCom: DDListStandardComponent;
    @ViewChild('rtsctsCom', {static: false}) _rtsctsCom: CheckSimpleComponent;
    @ViewChild('xonCom', {static: false}) _xonCom: CheckSimpleComponent;
    @ViewChild('xoffCom', {static: false}) _xoffCom: CheckSimpleComponent;
    @ViewChild('xanyCom', {static: false}) _xanyCom: CheckSimpleComponent;
    @ViewChild('encodingCom', {static: false}) _encodingCom: DDListStandardComponent;

    @Input() public baudRate: number = 921600;
    @Input() public lock: boolean = false;
    @Input() public dataBits: number = 8;
    @Input() public highWaterMark: number = 65536;
    @Input() public stopBits: number = 1;
    @Input() public parity: string = 'none';
    @Input() public rtscts: boolean = false;
    @Input() public xon: boolean = false;
    @Input() public xoff: boolean = false;
    @Input() public xany: boolean = false;
    @Input() public delimiter: string = '\\n';
    @Input() public encoding: string = 'utf8';
    @Input() public includeDelimiter: boolean = false;
    @Input() public path: string;

    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _destroyed: boolean = false;

    public _ng_baudrateListed: number;
    public _ng_baudrateItems: Array<{ caption: string, value: any, }> = [
        { caption: 'custom', value: -1 },
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
        { caption: '921600', value: 921600 },
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
        this._ng_onBaudRateDDChange = this._ng_onBaudRateDDChange.bind(this);
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        this._ng_baudrateListed = this.baudRate;
        this._forceUpdate();
    }

    ngAfterContentInit() {
        this.delimiter = this.delimiter.replace(/\n/gi, '\\n').replace(/\r/gi, '\\r').replace(/\t/gi, '\\t');
    }

    public _ng_onBaudRateDDChange(value: string | number) {
        this._ng_baudrateListed = parseInt(value as string, 10);
        this._forceUpdate();
    }

    public _ng_isBaunRateCustom(): boolean {
        return this._ng_baudrateListed === -1;
    }

    public getOptions(): IOptions {
        return {
            path: this.path,
            options: {
                baudRate: this._getBaudRate(),
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
                delimiter: this._getDelimiter(),
                includeDelimiter: false
            }
        };
    }

    private _getDelimiter(): string {
        const delimiter: string = this._delimiterCom.getValue() as string;
        return `${delimiter}`.replace(/\\n/gi, '\n').replace(/\\r/gi, '\r').replace(/\\t/gi, '\t');
    }

    private _getBaudRate(): number {
        const value = this._baudRateInputCom !== undefined ? this._baudRateInputCom.getValue() : this._baudRateDDCom.getValue();
        return typeof value === 'string' ? parseInt(value, 10) : value;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

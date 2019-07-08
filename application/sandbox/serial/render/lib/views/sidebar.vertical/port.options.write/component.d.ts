import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { IOptions } from '../../../common/interface.options';
import { CheckSimpleComponent, InputStandardComponent, DDListStandardComponent } from 'logviewer-client-primitive';
export declare class SidebarVerticalPortOptionsWriteComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _baudRateCom: DDListStandardComponent;
    _lockCom: CheckSimpleComponent;
    _dataBitsCom: DDListStandardComponent;
    _highWaterMarkCom: InputStandardComponent;
    _stopBitsCom: DDListStandardComponent;
    _parityCom: DDListStandardComponent;
    _rtsctsCom: CheckSimpleComponent;
    _xonCom: CheckSimpleComponent;
    _xoffCom: CheckSimpleComponent;
    _xanyCom: CheckSimpleComponent;
    _encodingCom: DDListStandardComponent;
    baudRate: number;
    lock: boolean;
    dataBits: number;
    highWaterMark: number;
    stopBits: number;
    parity: string;
    rtscts: boolean;
    xon: boolean;
    xoff: boolean;
    xany: boolean;
    delimiter: string;
    encoding: string;
    includeDelimiter: boolean;
    path: string;
    private _subscriptions;
    private _destroyed;
    _ng_baudrateItems: Array<{
        caption: string;
        value: any;
    }>;
    _ng_databitsItems: Array<{
        caption: string;
        value: any;
    }>;
    _ng_stopbitsItems: Array<{
        caption: string;
        value: any;
    }>;
    _ng_parityItems: Array<{
        caption: string;
        value: any;
    }>;
    _ng_encodingItems: Array<{
        caption: string;
        value: any;
    }>;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    getOptions(): IOptions;
    private _forceUpdate;
}

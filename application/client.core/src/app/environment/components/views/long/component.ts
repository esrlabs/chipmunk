import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Observable } from 'rxjs';
import { IComponentDesc  } from 'logviewer-client-containers';
import { ControllerSessionTab, IComponentInjection } from '../../../controller/controller.session.tab';
import { ControllerSessionTabStreamOutput, IStreamPacket, IUpdateData } from '../../../controller/controller.session.tab.stream.output';

enum EScrollBarType {
    horizontal = 'horizontal',
    vertical = 'vertical'
}

export interface IRange {
    start: number;
    end: number;
}

export interface IIndex {
    view: number;
    storage: number;
}

export interface IRow {
    index: IIndex;
    component: IComponentDesc;
}

export interface IStorageInformation {
    count: number;
    loaded: IRange;
}

export interface IViewInformation {
    rendered: IRange;
    count: number;
}

export interface IOutputSettings {
    rowHeight: number;
}

export interface IDataAPI {
    getRange: (range: IRange) => IRow[];
    getStorageInfo: () => IStorageInformation;
    onStorageUpdated: Observable<IStorageInformation>;
}

@Component({
    selector: 'app-views-infinity-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewInfinityOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('container') _ng_nodeContainer: ElementRef;
    @ViewChild('holder') _ng_nodeHolder: ElementRef;
    @ViewChild('filler') _ng_nodeFiller: ElementRef;

    @Input() public API: IDataAPI | undefined;

    public _ng_rows: IRow[] = [];

    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngAfterViewInit() {
    }

    public ngAfterContentInit() {
    }

    public ngOnDestroy() {
    }

    public _ng_onBrowserWindowResize() {
    }

}

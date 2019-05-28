import { Component, OnDestroy, ChangeDetectorRef, ViewChild, QueryList, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';

@Component({
    selector: 'app-sidebar-app-searchmanager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerComponent implements OnDestroy, AfterContentInit {

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    public ngOnDestroy() {
    }

    public ngAfterContentInit() {

    }

}

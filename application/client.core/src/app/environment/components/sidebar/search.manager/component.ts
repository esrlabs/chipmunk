import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';

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

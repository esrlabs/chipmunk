import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';

@Component({
    selector: 'app-apps-status-bar-electron-state-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class StateHistoryComponent implements AfterViewInit {
    @Input() public history!: string[];

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterViewInit() {}
}

// tslint:disable:member-ordering

import * as Toolkit from 'chipmunk.client.toolkit';

import { Component, OnDestroy, ChangeDetectorRef, Input, ViewChild, AfterContentInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerFileMergeSession, IMergeFile } from '../../../../controller/controller.file.merge.session';

@Component({
    selector: 'app-sidebar-app-files-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesListComponent implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges {

    @Input() public controller: ControllerFileMergeSession;
    @Input() public select: Subject<IMergeFile>;

    public _ng_files: IMergeFile[] = [];

    private _lastSelectedFilePath: string | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
        this._subscribe(this.controller);
        this._ng_files = this.controller.getFiles();
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.controller === undefined) {
            return;
        }
        this._subscribe(changes.controller.currentValue);
        if (changes.controller.previousValue !== undefined && changes.controller.previousValue.getGuid() === this.controller.getGuid()) {
            return;
        }
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onSelect(file: IMergeFile) {
        if (file.info === undefined || file.path === this._lastSelectedFilePath) {
            this._lastSelectedFilePath = undefined;
            this.select.next(undefined);
        } else if (file.info !== undefined) {
            this._lastSelectedFilePath = file.path;
            this.select.next(file);
        }
    }

    private _subscribe(controller: ControllerFileMergeSession | undefined) {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (controller === undefined) {
            return;
        }
        this._subscriptions.FilesUpdated = controller.getObservable().FilesUpdated.subscribe(this._onFilesUpdated.bind(this));
        this._subscriptions.FileUpdated = controller.getObservable().FileUpdated.subscribe(this._onFileUpdated.bind(this));
    }

    private _onFilesUpdated(files: IMergeFile[]) {
        this._ng_files = files;
        if (this._ng_files.length === 0) {
            this.select.next(undefined);
        }
        this._forceUpdate();
    }

    private _onFileUpdated(file: IMergeFile) {
        this._ng_files = this._ng_files.map((_file: IMergeFile) => {
            return _file.path === file.path ? file : _file;
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

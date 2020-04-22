import { Component, OnDestroy, ChangeDetectorRef, Input, OnChanges, AfterContentInit, AfterViewInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerFileMergeSession, IMergeFile, IFileOptions } from '../../../../controller/controller.file.merge.session';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-files-options',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class SidebarAppMergeFilesOptionsComponent implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges {

    @Input() public controller: ControllerFileMergeSession;
    @Input() public file: IMergeFile;

    public _ng_year: string = '';
    public _ng_offset: number = 0;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
        this._setOptions();
    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.file === undefined) {
            return;
        }
        if (changes.file.previousValue !== undefined && changes.file.previousValue.path === this.file.path) {
            return;
        }
        this._setOptions();
    }

    public _ng_onYearChange() {
        this.controller.setOptions(this.file.path, this._getOptions());
    }

    public _ng_onOffsetChange() {
        this.controller.setOptions(this.file.path, this._getOptions());
    }

    private _getOptions(): IFileOptions {
        function getNum(str: string | number): number | undefined {
            if (typeof str === 'string' && str.trim() === '') {
                return undefined;
            }
            const num: number = typeof str === 'string' ? parseInt(str, 10) : str;
            if (isNaN(num) || !isFinite(num) || num < 0) {
                return undefined;
            } else {
                return num;
            }
        }
        return {
            year: getNum(this._ng_year),
            offset: getNum(this._ng_offset),
        };
    }

    private _setOptions() {
        this._ng_year = '';
        this._ng_offset = undefined;
        if (this.file.options === undefined) {
            return;
        }
        if (this.file.options.year !== undefined) {
            this._ng_year = this.file.options.year.toString();
        }
        if (this.file.options.offset !== undefined) {
            this._ng_offset = this.file.options.offset;
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

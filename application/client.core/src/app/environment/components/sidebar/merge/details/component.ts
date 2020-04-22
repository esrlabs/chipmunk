import { Component, OnDestroy, ChangeDetectorRef, Input, OnChanges, AfterContentInit, AfterViewInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerFileMergeSession, IMergeFile } from '../../../../controller/controller.file.merge.session';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EFormatState {
    requiredtest = 'requiredtest',
    tested = 'tested',
    testing = 'testing',
}

@Component({
    selector: 'app-sidebar-app-files-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class SidebarAppMergeFilesDetailsComponent implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges {

    @Input() public controller: ControllerFileMergeSession;
    @Input() public file: IMergeFile;

    public _ng_preview: SafeHtml[] = [];
    public _ng_format: string = '';
    public _ng_state: EFormatState = EFormatState.tested;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
        this._setPreview();
        this._setFormat();
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
        this._setPreview(changes.file.currentValue);
    }

    public _ng_onFormatChange() {
        if (this.file.format === undefined) {
            this._ng_state = EFormatState.requiredtest;
            return;
        }
        if (this.file.format.format === this._ng_format) {
            this._ng_state = EFormatState.tested;
        } else {
            this._ng_state = EFormatState.requiredtest;
        }
    }

    public _ng_onApply() {
        if (this.file.format === undefined || this.file.format.format === this._ng_format) {
            return;
        }
        this.file.format.format = this._ng_format;
        this.controller.update(this.file.path, this.file);
    }

    private _setPreview(file?: IMergeFile) {
        if (file === undefined) {
            file = this.file;
        }
        if (this.file.info === undefined || typeof this.file.info.preview !== 'string') {
            this._ng_preview = [];
        } else {
            let stampregexp: RegExp | Error | undefined;
            if (this.file.format !== undefined && Toolkit.regTools.isRegStrValid(this.file.format.regex)) {
                stampregexp = Toolkit.regTools.createFromStr(this.file.format.regex);
            }
            this._ng_preview = this.file.info.preview.split(/[\n\r]/gi).map((row: string) => {
                row = row.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
                if (stampregexp instanceof RegExp) {
                    const matches: RegExpMatchArray | null = row.match(stampregexp);
                    if (matches !== null && matches.length !== 0) {
                        Array.prototype.forEach.call(matches, (match: string) => {
                            row = row.replace(match, '<span class="match">' + match + '</span>')
                        });
                    }
                }
                return this._sanitizer.bypassSecurityTrustHtml(row);
            });
        }
    }

    private _setFormat() {
        if (this.file.format === undefined) {
            this._ng_format = '';
        } else {
            this._ng_format = this.file.format.format;
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

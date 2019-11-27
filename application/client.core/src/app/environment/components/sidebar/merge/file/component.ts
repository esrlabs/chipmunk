// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, ViewChild, AfterContentInit, AfterViewInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as Toolkit from 'chipmunk.client.toolkit';
import { InputStandardComponent } from 'chipmunk-client-primitive';
import { IFile as ITestResult } from '../../../../../../../../common/ipc/electron.ipc.messages/merge.files.test.response';
import { Subscription, Observable, Subject } from 'rxjs';

const ListOffsetValue: string = 'offset';

const COptionButton = {
    show: 'More Options',
    hide: 'Less Options'
};

const CPreviewButton = {
    show: 'Show preview of file',
    hide: 'Hide preview of file'
};

const CDateTimeAliases = ['YYYY', 'MM', 'MMM', 'DD', 'hh', 'mm', 'ss', '.s', 'sss', 'TZD'];

enum EDataTimeAliases {
    YYYY = 'YYYY',
    MM = 'MM',
    MMM = 'MMM',
    DD = 'DD',
    hh = 'hh',
    mm = 'mm',
    ss = 'ss',
    s = '.s',
    sss = 'sss',
    tzd = 'TZD'
}

@Component({
    selector: 'app-sidebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesItemComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @ViewChild('yearinput', {static: false}) _yearComRef: InputStandardComponent;
    @ViewChild('formatinput', {static: false}) _formatComRef: InputStandardComponent;
    @ViewChild('offsetinput', {static: false}) _offsetComRef: InputStandardComponent;

    @Input() public file: string = '';
    @Input() public name: string = '';
    @Input() public preview: string = '';
    @Input() public size: number = 0;
    @Input() public parser: string = '';
    @Input() public zones: string[] = [];
    @Input() public defaultFormat: string | undefined;
    @Input() public onUpdated: (warn: boolean, err: boolean) => any = () => void 0;
    @Input() public onRemove: () => any = () => void 0;
    @Input() public onTest: () => any = () => void 0;
    @Input() public onExtendObs: Observable<string>;
    @Input() public onExtendSub: Subject<string>;


    public _ng_zones: Array<{ value: string; caption: string}> = [];
    public _ng_disabled: boolean = false;
    public _ng_offset: number | undefined = undefined;
    public _ng_moreButtonTitle: string = COptionButton.show;
    public _ng_testResults: ITestResult | undefined = undefined;
    public _ng_rows: SafeHtml[] = [];
    public _ng_warnings: string[] = [];
    public _ng_format: string = '';
    public _ng_previewButtonTitle: string = CPreviewButton.show;

    private _valid: boolean = false;
    private _previewRows: string[] = [];
    private _year: number = -1;
    private _offset: number = 0;
    private _zone: string = '';
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
        this._ng_onZoneChange = this._ng_onZoneChange.bind(this);
        this._ng_onOffsetChange = this._ng_onOffsetChange.bind(this);
        this._ng_onOffsetValidate = this._ng_onOffsetValidate.bind(this);
        this._ng_onYearValidate = this._ng_onYearValidate.bind(this);
        this._ng_onYearChange = this._ng_onYearChange.bind(this);
        this._ng_onFormatChange = this._ng_onFormatChange.bind(this);
        this._ng_onFormatValidate = this._ng_onFormatValidate.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_zones = this.zones.map((zone: string) => {
            return { value: zone, caption: zone };
        });
        this._previewRows = this.preview.split(/[\n\r]/gi);
        this._ng_zones.unshift({ value: ListOffsetValue, caption: 'Set time offset in ms' });
        this._ng_zones.unshift({ value: '', caption: 'Select time zone or offset' });
        this._ng_rows = this._getReadRows();
    }

    public ngAfterViewInit() {
        if (this.defaultFormat !== undefined) {
            this._formatComRef.setValue(this.defaultFormat);
        }
        if (this.onExtendObs !== undefined) {
            this._subscriptions.onExtended = this.onExtendObs.subscribe(this._onExtendedFormat.bind(this));
        }
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onMore() {
        this._ng_moreButtonTitle = this._ng_moreButtonTitle === COptionButton.show ? COptionButton.hide : COptionButton.show;
        if (this._ng_moreButtonTitle === COptionButton.show) {
            this._offset = -1;
            this._zone = '';
            this._year = -1;
        }
        this._forceUpdate();
    }

    public _ng_isMoreOpened(): boolean {
        return this._ng_moreButtonTitle === COptionButton.hide;
    }

    public _ng_onPreviewToggle() {
        this._ng_previewButtonTitle = this._ng_previewButtonTitle === CPreviewButton.show ? CPreviewButton.hide : CPreviewButton.show;
        this._ng_rows = this._getReadRows();
        this._forceUpdate();
    }

    public _ng_isPreviewOpened(): boolean {
        return this._ng_previewButtonTitle === CPreviewButton.hide;
    }

    public _ng_onOffsetValidate(value: string): string | undefined {
        const num: number = parseInt(value, 10);
        if (!isNaN(num) && isFinite(num)) {
            return undefined;
        }
        return 'Incorrect time offset.';
    }

    public _ng_onOffsetChange(value: string) {
        this._offset = parseInt(value, 10);
    }

    public _ng_onFormatValidate(value: string): string | undefined {
        this._valid = value.trim() !== '';
        this._updateWarningMsg();
        return undefined;
    }

    public _ng_onFormatChange(value: string) {
        this._ng_format = value;
        this.dropTestResults();
        this._updateWarningMsg();
    }

    public _ng_onZoneChange(value: string) {
        this._zone = value;
        if (this._zone === ListOffsetValue) {
            this._ng_offset = 0;
        } else if (this._ng_offset !== undefined) {
            this._ng_offset = undefined;
        }
        this._forceUpdate();
    }

    public _ng_onYearValidate(value: string): string | undefined {
        const year: number = parseInt(value, 10);
        if (!isNaN(year) && isFinite(year)) {
            return undefined;
        }
        this._valid = false;
        return 'Incorrect value of year.';
    }

    public _ng_onYearChange(value: string) {
        this._year = parseInt(value, 10);
    }

    public _ng_onRemove() {
        this.onRemove();
    }

    public _ng_onTest() {
        if (!this._ng_isPreviewOpened()) {
            this._ng_onPreviewToggle();
        }
        this.onTest();
    }

    public _ng_onExtend() {
        this.onExtendSub.next(this._ng_format);
    }

    public isValid(): boolean {
        this.refresh();
        return this._valid;
    }

    public refresh() {
        this._valid = true;
        if (this._offsetComRef !== null && this._offsetComRef !== undefined) {
            this._offsetComRef.refresh();
        }
        if (this._yearComRef !== null && this._yearComRef !== undefined) {
            this._yearComRef.refresh();
        }
        if (this._formatComRef !== null && this._formatComRef !== undefined) {
            this._formatComRef.refresh();
        } else {
            this._updateWarningMsg();
        }
    }

    public getFile(): string {
        return this.file;
    }

    public getParser(): string {
        return this.parser;
    }

    public getTimezone(): string {
        return this._zone;
    }

    public getOffset(): number {
        return this._offset;
    }

    public getYear(): number | undefined {
        return this._year === -1 ? undefined : this._year;
    }

    public getFormat(): string {
        return this._ng_format;
    }

    public setFormat(format: string) {
        this._ng_format = format;
        if (this._formatComRef !== null && this._formatComRef !== undefined) {
            this._formatComRef.setValue(format);
        }
    }

    public setTestResults(results: ITestResult | undefined) {
        this._ng_testResults = results;
        this._ng_rows = this._getReadRows();
        this._forceUpdate();
    }

    public dropTestResults() {
        if (this._ng_testResults === undefined) {
            return;
        }
        this._ng_testResults = undefined;
        this._ng_rows = this._getReadRows();
        this._forceUpdate();
    }

    public disable() {
        this._ng_disabled = true;
        this._forceUpdate();
    }

    public enable() {
        this._ng_disabled = false;
        this._forceUpdate();
    }

    public hasWarnings(): boolean {
        return this._ng_warnings.length > 0;
    }

    private _onExtendedFormat(format: string) {
        this._ng_format = format;
        this._formatComRef.setValue(format);
        this._forceUpdate();
    }

    private _getReadRows(): SafeHtml[]  {
        if (!this._ng_isPreviewOpened()) {
            return [];
        }
        let reg: RegExp | Error | undefined;
        if (this._ng_testResults !== undefined && this._ng_testResults.error === undefined) {
            reg = Toolkit.regTools.createFromStr(this._ng_testResults.regExpStr, 'i');
            if (reg instanceof Error) {
                reg = undefined;
            }
        }
        return this._previewRows.map((row: string) => {
            let html: string = row;
            if (reg !== undefined) {
                html = row.replace(reg as RegExp, (match: string, ...args: any[]) => {
                    return `<span class="noreset match">${match}</span>`;
                });
            }
            return this._sanitizer.bypassSecurityTrustHtml(html);
        });
    }

    private _updateWarningMsg() {
        const format: string | undefined = this._getFormatValidMsg();
        const complite: string | undefined = this._getFormatCompliteMsg();
        const was: number = this._ng_warnings.length;
        this._ng_warnings = [];
        if (format !== undefined) {
            this._ng_warnings.push(format);
        }
        if (complite !== undefined) {
            this._ng_warnings.push(complite);
        }
        this.onUpdated(this.hasWarnings(), !this._valid);
        if (was !== this._ng_warnings.length) {
            this._forceUpdate();
        }
    }

    private _getFormatValidMsg(): string | undefined {
        let valid: boolean = false;
        let value: string = this._ng_format;
        CDateTimeAliases.forEach((single: string) => {
            if (value.indexOf(single) !== -1) {
                valid = true;
            }
        });
        if (!valid) {
            return `Available format aliases: ${CDateTimeAliases.join(', ')}`;
        }
        const wrong = [/\s{2,}/gi, /-{2,}/gi, /\/{2,}/gi, /:{2,}/gi, /\.{2,}/gi];
        wrong.forEach((reg: RegExp) => {
            if (value.search(reg) !== -1) {
                valid = false;
            }
        });
        if (!valid) {
            return 'Special symbols cannot be used one by one: ., /, -, : and space';
        }
        CDateTimeAliases.forEach((single: string) => {
            value = value.replace(single, '');
        });
        const mutliple = [/\s/gi, /-/gi, /\//gi, /:/gi, /\./gi];
        mutliple.forEach((reg: RegExp) => {
            value = value.replace(reg, '');
        });
        if (value === '') {
            return undefined;
        }
        return `Not valid part of format: ${this._ng_format}`;
    }

    private _getFormatCompliteMsg(): string | undefined {
        let isDateSet: boolean = false;
        let isTimeSet: boolean = false;
        let isUTimeSet: boolean = false;
        [EDataTimeAliases.YYYY, EDataTimeAliases.MM, EDataTimeAliases.DD].forEach((single: string) => {
            if (this._ng_format.indexOf(single) !== -1) {
                isDateSet = true;
            }
        });
        [EDataTimeAliases.hh, EDataTimeAliases.mm, EDataTimeAliases.ss].forEach((single: string) => {
            if (this._ng_format.indexOf(single) !== -1) {
                isTimeSet = true;
            }
        });
        [EDataTimeAliases.sss].forEach((single: string) => {
            if (this._ng_format.indexOf(single) !== -1) {
                isUTimeSet = true;
            }
        });
        if (isUTimeSet) {
            return undefined;
        }
        if (isTimeSet && isDateSet) {
            return undefined;
        }
        return `Date format isn't full`;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

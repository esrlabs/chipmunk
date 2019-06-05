// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, ViewChild, AfterContentInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as Toolkit from 'logviewer.client.toolkit';
import { InputStandardComponent } from 'logviewer-client-primitive';
import { IFile as ITestResult } from '../../../../services/electron.ipc.messages/merge.files.test.response';

const ListOffsetValue: string = 'offset';

const COptionButton = {
    show: 'More Options',
    hide: 'Less Options'
};

@Component({
    selector: 'app-sidebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesItemComponent implements OnDestroy, AfterContentInit {

    @ViewChild('yearinput') _yearComRef: InputStandardComponent;
    @ViewChild('formatinput') _formatComRef: InputStandardComponent;
    @ViewChild('offsetinput') _offsetComRef: InputStandardComponent;

    @Input() public file: string = '';
    @Input() public name: string = '';
    @Input() public preview: string = '';
    @Input() public size: number = 0;
    @Input() public parser: string = '';
    @Input() public zones: string[] = [];
    @Input() public onRemove: () => any = () => void 0;
    @Input() public onTest: () => any = () => void 0;

    public _ng_zones: Array<{ value: string; caption: string}> = [];
    public _ng_disabled: boolean = false;
    public _ng_offset: number | undefined = undefined;
    public _ng_moreButtonTitle: string = COptionButton.show;
    public _ng_testResults: ITestResult | undefined = undefined;
    public _ng_rows: SafeHtml[] = [];

    private _valid: boolean = false;
    private _year: number = -1;
    private _offset: number = 0;
    private _zone: string = '';
    private _format: string = '';

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
        this._ng_zones.unshift({ value: ListOffsetValue, caption: 'Set time offset in ms' });
        this._ng_zones.unshift({ value: '', caption: 'Select time zone or offset' });
        this._ng_rows = this._getReadRows();
        this._cdRef.detectChanges();
    }

    public ngOnDestroy() {
    }

    public _ng_onMore() {
        this._ng_moreButtonTitle = this._ng_moreButtonTitle === COptionButton.show ? COptionButton.hide : COptionButton.show;
        if (this._ng_moreButtonTitle === COptionButton.show) {
            this._offset = -1;
            this._zone = '';
            this._year = -1;
        }
        this._cdRef.detectChanges();
    }

    public _ng_isMoreOpened(): boolean {
        return this._ng_moreButtonTitle === COptionButton.hide;
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
        if (value === '') {
            this._valid = false;
            return 'Format of date/time should be defined.';
        }
        const singles = ['YYYY', 'MM', 'DD', 'hh', 'mm', 'ss', '.s', 'TZD', 'T'];
        let valid: boolean = false;
        singles.forEach((single: string) => {
            if (value.indexOf(single) !== -1) {
                valid = true;
            }
        });
        if (!valid) {
            this._valid = false;
            return 'At least one date/time part should be defined: YYYY, DD, MM, hh, mm, ss, .s, T and TZD';
        }
        const wrong = [/\s{2,}/gi, /-{2,}/gi, /\/{2,}/gi, /:{2,}/gi, /\.{2,}/gi];
        wrong.forEach((reg: RegExp) => {
            if (value.search(reg) !== -1) {
                valid = false;
            }
        });
        if (!valid) {
            this._valid = false;
            return 'Special symbols cannot be used one by one: ., /, -, : and space';
        }
        singles.forEach((single: string) => {
            value = value.replace(single, '');
        });
        const mutliple = [/\s/gi, /-/gi, /\//gi, /:/gi, /\./gi];
        mutliple.forEach((reg: RegExp) => {
            value = value.replace(reg, '');
        });
        if (value === '') {
            return undefined;
        }
        this._valid = false;
        return `Not valid part of format: ${value}`;
    }

    public _ng_onFormatChange(value: string) {
        this._format = value;
        this.dropTestResults();
    }

    public _ng_onZoneChange(value: string) {
        this._zone = value;
        if (this._zone === ListOffsetValue) {
            this._ng_offset = 0;
            this._cdRef.detectChanges();
        } else if (this._ng_offset !== undefined) {
            this._ng_offset = undefined;
            this._cdRef.detectChanges();
        }
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
        this.onTest();
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
        return this._format;
    }

    public setTestResults(results: ITestResult | undefined) {
        this._ng_testResults = results;
        this._ng_rows = this._getReadRows();
        this._cdRef.detectChanges();
    }

    public dropTestResults() {
        this._ng_testResults = undefined;
        this._ng_rows = this._getReadRows();
        this._cdRef.detectChanges();
    }

    public disable() {
        this._ng_disabled = true;
        this._cdRef.detectChanges();
    }

    public enable() {
        this._ng_disabled = false;
        this._cdRef.detectChanges();
    }

    private _getReadRows(): SafeHtml[]  {
        let reg: RegExp | Error | undefined;
        if (this._ng_testResults !== undefined && this._ng_testResults.error === undefined) {
            reg = Toolkit.regTools.createFromStr(this._ng_testResults.regExpStr);
            if (reg instanceof Error) {
                reg = undefined;
            }
        }
        const rows: string[] = this.preview.split(/[\n\r]/gi);
        return rows.map((row: string) => {
            let html: string = row;
            if (reg !== undefined) {
                html = row.replace(reg as RegExp, (match: string, ...args: any[]) => {
                    return `<span class="noreset match">${match}</span>`;
                });
            }
            return this._sanitizer.bypassSecurityTrustHtml(html);
        });
    }

}

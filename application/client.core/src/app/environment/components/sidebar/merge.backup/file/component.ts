// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, ViewChild, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { InputStandardComponent } from 'logviewer-client-primitive';
import { IFile as ITestResult } from '../../../../services/electron.ipc.messages/merge.files.test.response';

const ListOffsetValue: string = 'offset';

export enum ETypes {
    regexp = 'regexp',
    format = 'format'
}

@Component({
    selector: 'app-sidebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesItemComponent implements OnDestroy, AfterContentInit {

    @ViewChild('valueinput') _valueComRef: InputStandardComponent;
    @ViewChild('formatinput') _formatComRef: InputStandardComponent;
    @ViewChild('offsetinput') _offsetComRef: InputStandardComponent;


    @Input() public file: string = '';
    @Input() public name: string = '';
    @Input() public parser: string = '';
    @Input() public zones: string[] = [];
    @Input() public onRemove: () => any = () => void 0;

    public _ng_zones: Array<{ value: string; caption: string}> = [];
    public _ng_disabled: boolean = false;
    public _ng_offset: number | undefined = undefined;
    public _ng_options: Array<{ value: string; caption: string}> = [
        { value: ETypes.regexp, caption: 'Use RegExp to find date' },
        { value: ETypes.format, caption: 'Use RegExp and format' },
    ];

    private _valid: boolean = false;
    private _value: string = '';
    private _format: string = '';
    private _type: ETypes = ETypes.regexp;
    private _offset: number = 0;
    private _zone: string = '';
    private _result: ITestResult | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onZoneChange = this._ng_onZoneChange.bind(this);
        this._ng_onTypeChange = this._ng_onTypeChange.bind(this);
        this._ng_onValueChange = this._ng_onValueChange.bind(this);
        this._ng_onOffsetChange = this._ng_onOffsetChange.bind(this);
        this._ng_onValueValidate = this._ng_onValueValidate.bind(this);
        this._ng_onOffsetValidate = this._ng_onOffsetValidate.bind(this);
        this._ng_onFormatValidate = this._ng_onFormatValidate.bind(this);
        this._ng_onFormatChange = this._ng_onFormatChange.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_zones = this.zones.map((zone: string) => {
            return { value: zone, caption: zone };
        });
        this._ng_zones.unshift({ value: ListOffsetValue, caption: 'Set time offset in ms' });
        this._ng_zones.unshift({ value: '', caption: 'Select time zone or offset' });
        this._cdRef.detectChanges();
    }

    public ngOnDestroy() {
    }

    public _ng_onValueValidate(value: string): string | undefined {
        if (value.trim() !== '' && Toolkit.regTools.isRegStrValid(value)) {
            this._valid = true;
            return undefined;
        }
        this._valid = false;
        return 'Incorrect regular expression';
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

    public _ng_onValueChange(value: string) {
        this._value = value;
        if (this._result !== undefined) {
            this._result = undefined;
            this._cdRef.detectChanges();
        }
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

    public _ng_onTypeChange(value: string) {
        this._type = value as ETypes;
        this._format = '';
        if (this._formatComRef !== null && this._formatComRef !== undefined) {
            this._formatComRef.drop();
        }
        this.dropResults();
        this._cdRef.detectChanges();
    }

    public _ng_onFormatValidate(value: string): string | undefined {
        if (value.trim() !== '') {
            return undefined;
        }
        this._valid = false;
        return 'Incorrect datetime format.';
    }

    public _ng_onFormatChange(value: string) {
        this._format = value;
    }

    public _ng_getSize(): string {
        if (this._result === undefined) {
            return '';
        }
        return (this._result.size / 1024 / 1024).toFixed(2);
    }

    public _ng_isFormatAllowed(): boolean {
        return this._type === ETypes.format;
    }

    public isValid(): boolean {
        this.refresh();
        return this._valid;
    }

    public getValue(): string {
        return this._value;
    }

    public getFormat(): string {
        return this._format;
    }

    public getType(): ETypes {
        return this._type;
    }

    public refresh() {
        this._valueComRef.refresh();
        if (this._offsetComRef !== null && this._offsetComRef !== undefined) {
            this._offsetComRef.refresh();
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

    public setResults(results: ITestResult) {
        this._result = results;
        this._cdRef.detectChanges();
    }

    public dropResults() {
        this._result = undefined;
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

}

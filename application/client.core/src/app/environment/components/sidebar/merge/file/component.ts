// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, ViewChild, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { InputStandardComponent } from 'logviewer-client-primitive';
import { IFile as ITestResult } from '../../../../services/electron.ipc.messages/merge.files.test.response';

const ListOffsetValue: string = 'offset';

const COptionButton = {
    show: 'Show Options',
    hide: 'Hide Options'
};

@Component({
    selector: 'app-sizebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesItemComponent implements OnDestroy, AfterContentInit {

    @ViewChild('yearinput') _yearComRef: InputStandardComponent;
    @ViewChild('offsetinput') _offsetComRef: InputStandardComponent;


    @Input() public file: string = '';
    @Input() public name: string = '';
    @Input() public parser: string = '';
    @Input() public zones: string[] = [];
    @Input() public onRemove: () => any = () => void 0;

    public _ng_zones: Array<{ value: string; caption: string}> = [];
    public _ng_disabled: boolean = false;
    public _ng_offset: number | undefined = undefined;
    public _ng_moreButtonTitle: string = COptionButton.show;

    private _valid: boolean = false;
    private _year: number = -1;
    private _offset: number = 0;
    private _zone: string = '';

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onZoneChange = this._ng_onZoneChange.bind(this);
        this._ng_onOffsetChange = this._ng_onOffsetChange.bind(this);
        this._ng_onOffsetValidate = this._ng_onOffsetValidate.bind(this);
        this._ng_onYearValidate = this._ng_onYearValidate.bind(this);
        this._ng_onYearChange = this._ng_onYearChange.bind(this);
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

    public isValid(): boolean {
        this.refresh();
        return this._valid;
    }

    public refresh() {
        if (this._offsetComRef !== null && this._offsetComRef !== undefined) {
            this._offsetComRef.refresh();
        } else {
            this._valid = true;
        }
        if (this._yearComRef !== null && this._yearComRef !== undefined) {
            this._yearComRef.refresh();
        } else {
            this._valid = true;
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

    public disable() {
        this._ng_disabled = true;
        this._cdRef.detectChanges();
    }

    public enable() {
        this._ng_disabled = false;
        this._cdRef.detectChanges();
    }

}

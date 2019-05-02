// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, ViewChild, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { InputStandardComponent } from 'logviewer-client-primitive';
import { IFile as ITestResult } from '../../../../services/electron.ipc.messages/merge.files.test.response';

@Component({
    selector: 'app-sizebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesItemComponent implements OnDestroy, AfterContentInit {

    @ViewChild(InputStandardComponent) _inputComRef: InputStandardComponent;

    @Input() public file: string = '';
    @Input() public name: string = '';
    @Input() public parser: string = '';
    @Input() public zones: string[] = [];
    @Input() public onRemove: () => any = () => void 0;

    public _ng_zones: Array<{ value: string; caption: string}> = [];
    public _ng_disabled: boolean = false;

    private _valid: boolean = false;
    private _value: string = '';
    private _zone: string = '';
    private _result: ITestResult | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_onRegexpValidate = this._ng_onRegexpValidate.bind(this);
        this._ng_onRegexpChange = this._ng_onRegexpChange.bind(this);
        this._ng_onZoneChange = this._ng_onZoneChange.bind(this);
    }

    public ngAfterContentInit() {
        this._ng_zones = this.zones.map((zone: string) => {
            return { value: zone, caption: zone };
        });
        this._ng_zones.unshift({ value: '', caption: 'Do not apply' });
        this._cdRef.detectChanges();
    }

    public ngOnDestroy() {
    }

    public _ng_onRegexpValidate(value: string): string | undefined {
        if (value.trim() !== '' && Toolkit.regTools.isRegStrValid(value)) {
            this._valid = true;
            return undefined;
        }
        return 'Incorrect regular expression';
    }

    public _ng_onRegexpChange(value: string) {
        this._value = value;
        if (this._result !== undefined) {
            this._result = undefined;
            this._cdRef.detectChanges();
        }
    }

    public _ng_onZoneChange(value: string) {
        this._zone = value;
    }

    public _ng_getSize(): string {
        if (this._result === undefined) {
            return '';
        }
        return (this._result.size / 1024 / 1024).toFixed(2);
    }

    public isValid(): boolean {
        return this._valid;
    }

    public getValue(): string {
        return this._value;
    }

    public refresh() {
        this._inputComRef.refresh();
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

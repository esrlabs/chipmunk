import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';

@Component({
    selector: 'lib-primitive-dropdownlist',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DDListStandardComponent implements AfterContentInit {

    public _ng_value: any;
    public _ng_error: string | undefined;

    @Input() public items: Array<{ caption: string, value: any, }> = [];
    @Input() public defaults: any;
    @Input() public placeholder: string = '';
    @Input() public disabled: boolean = false;
    @Input() public onFocus: (...args: any[]) => any = () => void 0;
    @Input() public onBlur: (...args: any[]) => any = () => void 0;
    @Input() public onChange: (value: string) => any = () => void 0;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    public ngAfterContentInit() {
        if (!(this.items instanceof Array) || this.items.length === 0) {
            return;
        }
        this._ng_value = this.defaults;
        this._cdRef.detectChanges();
    }

    public _ng_onChange(value: any) {
        this.onChange(value);
        this._cdRef.detectChanges();
    }

}

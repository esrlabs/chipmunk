import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';

@Component({
    selector: 'lib-primitive-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class InputStandardComponent implements AfterContentInit {

    public _ng_value: string | number = '';
    public _ng_error: string | undefined;

    @Input() public value: string | number = '';
    @Input() public placeholder: string = '';
    @Input() public type: string = '';
    @Input() public disabled: boolean = false;
    @Input() public onFocus: (...args: any[]) => any = () => void 0;
    @Input() public onBlur: (...args: any[]) => any = () => void 0;
    @Input() public onKeyDown: (...args: any[]) => any = () => void 0;
    @Input() public onKeyUp: (...args: any[]) => any = () => void 0;
    @Input() public onEnter: (...args: any[]) => any = () => void 0;
    @Input() public onChange: (value: string | number) => any = () => void 0;
    @Input() public validate: (input: string | number) => string | undefined = () => undefined;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    public ngAfterContentInit() {
        if (typeof this.value !== 'string' && typeof this.value !== 'number') {
            return;
        }
        this._ng_value = this.value;
        this._cdRef.detectChanges();
    }

    public drop() {
        this._ng_value = '';
    }

    public _ng_onChange(value: string | number) {
        this._ng_error = this.validate(value);
        this.onChange(value);
        this._cdRef.detectChanges();
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        this.onKeyUp(event);
        if (event.key === 'Enter' && this.validate(this._ng_value) === undefined) {
            this.onEnter(this._ng_value);
        }
    }

    public refresh() {
        this._ng_onChange(this._ng_value);
    }

    public setValue(value: string) {
        this._ng_value = value;
        this._ng_onChange(value);
    }

    public getValue(): string | number {
        return this._ng_value;
    }

}

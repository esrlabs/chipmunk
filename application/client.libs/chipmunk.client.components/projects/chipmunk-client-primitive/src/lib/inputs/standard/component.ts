import { Component, Input, AfterContentInit, AfterViewInit, ChangeDetectorRef, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';

@Component({
    selector: 'lib-primitive-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class InputStandardComponent implements AfterContentInit, OnChanges, AfterViewInit {

    public _ng_value: string | number = '';
    public _ng_error: string | undefined;

    @ViewChild('input', {static: false}) inputElRef: ElementRef;

    @Input() public value: string | number = '';
    @Input() public placeholder: string = '';
    @Input() public type: string = '';
    @Input() public disabled: boolean = false;
    @Input() public inlineErrors: boolean = false;
    @Input() public autoFocusOnInit: boolean = false;
    @Input() public onFocus: (...args: any[]) => any = () => void 0;
    @Input() public onBlur: (...args: any[]) => any = () => void 0;
    @Input() public onKeyDown: (...args: any[]) => any = () => void 0;
    @Input() public onKeyUp: (...args: any[]) => any = () => void 0;
    @Input() public onEnter: (...args: any[]) => any = () => void 0;
    @Input() public onChange: (value: string | number, event?: KeyboardEvent) => any = () => void 0;
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

    public ngAfterViewInit() {
        if (!this.autoFocusOnInit) {
            return;
        }
        if (this.inputElRef === undefined) {
            return;
        }
        (this.inputElRef.nativeElement as HTMLInputElement).focus();
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.value !== undefined) {
            this.value = changes.value.currentValue;
            this._ng_value = this.value;
        }
        if (changes.placeholder !== undefined) {
            this.placeholder = changes.placeholder.currentValue;
        }
        if (changes.type !== undefined) {
            this.type = changes.type.currentValue;
        }
        if (changes.disabled !== undefined) {
            this.disabled = changes.disabled.currentValue;
        }
        this._cdRef.detectChanges();
    }

    public drop() {
        this._ng_value = '';
    }

    public _ng_onChange(value: string | number, event?: KeyboardEvent) {
        this._ng_error = this.validate(value);
        this.onChange(value, event);
        this._cdRef.detectChanges();
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        this.onKeyUp(event);
        if (event.key === 'Enter' && this.validate(this._ng_value) === undefined) {
            this.onEnter(this._ng_value, event);
        }
    }

    public refresh() {
        this._ng_onChange(this._ng_value, undefined);
    }

    public setValue(value: string, silence: boolean = false) {
        this._ng_value = value;
        if (silence) {
            this._cdRef.detectChanges();
        } else {
            this._ng_onChange(value);
        }
    }

    public getValue(): string | number {
        return this._ng_value;
    }

    public focus() {
        if (this.inputElRef === undefined) {
            return;
        }
        this.inputElRef.nativeElement.focus();
    }

}

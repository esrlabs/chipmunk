import { Component, Input, AfterContentInit, ChangeDetectorRef, HostListener } from '@angular/core';

@Component({
    selector: 'lib-primitive-checkbox-simple',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class CheckSimpleComponent implements AfterContentInit {

    public _ng_label: string = '';

    @Input() public labelOn: string = '';
    @Input() public labelOff: string = '';
    @Input() public checked: boolean = false;
    @Input() public disabled: boolean = false;
    @Input() public color: string = '';
    @Input() public onChange: (value: boolean) => any = () => void 0;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    @HostListener('click', ['$event']) public onClick(event: MouseEvent) {
        if (this.disabled) {
            return;
        }
        this.checked = !this.checked;
        this.onChange(this.checked);
        this._setLabel();
        this._cdRef.detectChanges();
    }

    public ngAfterContentInit() {
        this._setLabel();
        this._cdRef.detectChanges();
    }

    public setValue(value: boolean) {
        this.checked = value;
        this._cdRef.detectChanges();
    }

    public getValue(): boolean {
        return this.checked;
    }

    private _setLabel() {
        this._ng_label = this.checked ? this.labelOn : this.labelOff;
    }

}

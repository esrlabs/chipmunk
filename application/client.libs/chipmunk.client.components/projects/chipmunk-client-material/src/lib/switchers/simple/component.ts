import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';

@Component({
    selector: 'lib-primitive-switcher-simple',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SwitcherSimpleComponent implements AfterContentInit {

    private _index: number = 0;

    public _ng_value: any;
    public _ng_error: string | undefined;

    @Input() public items: Array<{ caption: string, value: any, }> = [];
    @Input() public defaults: any;
    @Input() public disabled: boolean = false;
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

    public _ng_getStyle(index: number): { [key: string]: string } {
        if (index !== 0) {
            return {};
        }
        return {
            'margin-left': `-${100 * this._index}%`
        };
    }

    public _ng_getPosStyle(index: number): { [key: string]: string } {
        const styles = {
            'width': `${100 / this.items.length}%`,
        };
        if (index === this._index) {
            styles['background'] = '#FFFFFF';
        }
        return styles;
    }

    public _ng_next() {
        this._index += 1;
        if (this._index > this.items.length - 1) {
            this._index = 0;
        }
        this._ng_value = this.items[this._index].value;
        this.onChange(this._ng_value);
        this._cdRef.detectChanges();
    }

}

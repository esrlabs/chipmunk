import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';
import { IComponentDesc } from '../dynamic/component';

export interface IFrameOptions {
    onClose?: (...args: any[]) => any;
    closable?: boolean;
    caption?: string;
    style?: { [key: string]: string };
}

export { IComponentDesc };

@Component({
    selector: 'lib-containers-frame',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class FrameComponent implements OnDestroy, AfterViewInit {

    @Input() public content: IComponentDesc;
    @Input() public options: IFrameOptions = {};

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {

    }

    ngAfterViewInit() {
        if (typeof this.options.closable !== 'boolean') {
            this.options.closable = true;
        }
        if (typeof this.options.caption !== 'string') {
            this.options.caption = '';
        }
        this._cdRef.detectChanges();
    }

    public _ng_onClose() {
        if (typeof this.options.onClose === 'function') {
            this.options.onClose();
        }
    }


}

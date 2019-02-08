import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';
import { IComponentDesc } from '../../../support/dynamic/component';

export interface IFrameOptions {
    onClose?: (...args: any[]) => any;
    closable?: boolean;
    caption?: string;
    style?: { [key: string]: string };
}

export { IComponentDesc };

@Component({
    selector: 'app-wrappers-frame',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class WrappersFrameComponent implements OnDestroy, AfterViewInit {

    @Input() public content: IComponentDesc;
    @Input() public options: IFrameOptions = {};

    public ng_current: string = 'waiting';
    public ng_history: string[] = ['dfsdfdsfdsfs', 'fdsfdsfds fdsf sdf dsf f fdsfds', 'fdsfdsfds fdsf sdf dsf f fdsfds', 'fdsfdsfds fdsf sdf dsf f fdsfds', 'fdsfdsfds fdsf sdf dsf f fdsfds'];
    public ng_showHistory: boolean = false;

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

    private _ng_onClose() {
        if (typeof this.options.onClose === 'function') {
            this.options.onClose();
        }
    }


}

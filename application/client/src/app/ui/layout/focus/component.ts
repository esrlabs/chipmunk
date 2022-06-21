import { Component, ChangeDetectorRef, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-layout-focus',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutFocus implements AfterViewInit {
    @ViewChild('input') _ng_input!: ElementRef;

    constructor(private _cdRef: ChangeDetectorRef) {
        // this._subscriptions.onSessionChange =
        //     EventsSessionService.getObservable().onSessionChange.subscribe(
        //         this._onSessionChange.bind(this),
        //     );
    }

    ngAfterViewInit() {
        this._onSessionChange();
    }

    private _onSessionChange() {
        if (this._ng_input === undefined && (this._ng_input as any).nativeElement !== undefined) {
            return;
        }
        (this._ng_input.nativeElement as HTMLInputElement).focus();
    }
}
export interface LayoutFocus extends IlcInterface {}

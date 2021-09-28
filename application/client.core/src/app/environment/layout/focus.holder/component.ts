import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ElementRef,
    AfterViewInit,
    ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import EventsSessionService from '../../services/standalone/service.events.session';

@Component({
    selector: 'app-layout-focus-holder',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutFocusHolderComponent implements OnDestroy, AfterViewInit {
    @ViewChild('input') _ng_input!: ElementRef;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
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

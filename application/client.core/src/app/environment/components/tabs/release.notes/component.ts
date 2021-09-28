import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';

import ReleaseNotesService from '../../../services/service.release.notes';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-tabs-release-notes',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class TabReleaseNotesComponent implements OnDestroy, AfterViewInit {
    public _ng_version: string | undefined;
    public _ng_body: string | undefined;
    public _ng_error: string | undefined;

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterViewInit() {
        ReleaseNotesService.get()
            .then((info) => {
                this._ng_version = info.version;
                this._ng_body = info.notes;
            })
            .catch((err: Error) => {
                this._ng_error = err.message;
            })
            .finally(() => {
                this._forceUpdate();
            });
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

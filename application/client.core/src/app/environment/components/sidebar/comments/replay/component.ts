// tslint:disable: member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterViewInit,
    OnChanges,
    SimpleChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { ICommentResponse } from '../../../../controller/session/dependencies/comments/session.dependency.comments.types';
import { getDateTimeStr } from '../../../../controller/helpers/dates';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-comments-item-replay',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarAppCommentsItemReplayComponent implements OnDestroy, AfterViewInit, OnChanges {
    @Input() response!: ICommentResponse;
    @Input() color!: string | undefined;
    @Input() edit!: () => void;
    @Input() remove!: () => void;
    @Input() icon!: boolean;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterViewInit() {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnRemove() {
        setTimeout(() => {
            this.remove();
        }, 10);
    }

    public ngOnEdit() {
        this.edit();
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.response === undefined) {
            return;
        }
        this.response = changes.response.currentValue;
        this._forceUpdate();
    }

    public ngGetDateTime(): string {
        if (this.response.created === this.response.modified) {
            return getDateTimeStr(this.response.created);
        } else {
            return `${getDateTimeStr(this.response.created)} / ${getDateTimeStr(
                this.response.modified,
            )}`;
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

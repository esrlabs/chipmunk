// tslint:disable: member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { IComment } from '../../../../controller/controller.session.tab.stream.comments.types';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

@Component({
    selector: 'app-sidebar-app-comments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppCommentsItemComponent implements OnDestroy, AfterViewInit, OnChanges {

    @Input() comment: IComment;
    @Input() controller: ControllerSessionTab;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnEdit() {
        this.controller.getSessionComments().edit(this.comment);
    }

    public ngOnShow() {
        OutputRedirectionsService.select('comments_redirection', this.controller.getGuid(), this.comment.selection.start.position);
    }

    public ngOnRemove() {
        this.controller.getSessionComments().remove(this.comment.guid);
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.comment === undefined) {
            return;
        }
        this.comment = changes.comment.currentValue;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

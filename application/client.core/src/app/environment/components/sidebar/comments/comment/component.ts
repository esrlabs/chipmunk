// tslint:disable: member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, AfterViewInit, OnChanges, SimpleChanges, ViewEncapsulation, NgZone } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { IComment, ICommentResponse } from '../../../../controller/controller.session.tab.stream.comments.types';
import { CShortColors } from '../../../../conts/colors';
import { shadeColor } from '../../../../theme/colors';

import * as Toolkit from 'chipmunk.client.toolkit';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

@Component({
    selector: 'app-sidebar-app-comments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})

export class SidebarAppCommentsItemComponent implements OnDestroy, AfterViewInit, OnChanges {

    @Input() comment: IComment;
    @Input() controller: ControllerSessionTab;

    public _ng_colors: string[] = CShortColors.slice();
    public _ng_response: ICommentResponse | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _zone: NgZone) {
        this.ngOnResponseSave = this.ngOnResponseSave.bind(this);
        this.ngOnResponseCancel = this.ngOnResponseCancel.bind(this);
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

    public ngOnSetColor(color: string | undefined) {
        this.comment.color = color;
        this.controller.getSessionComments().update(this.comment);
        this._forceUpdate();
    }

    public ngOnReplay(ref: string | undefined) {
        if (ref === undefined) {
            this._ng_response = {
                guid: '',
                created: Date.now(),
                modified: Date.now(),
                comment: '',
            };
            this._forceUpdate();
        }
    }

    public ngOnResponseSave(comment: string) {
        if (comment !== '') {
            if (this._ng_response.guid === '') {
                this._ng_response.guid = Toolkit.guid();
                this._ng_response.comment = comment;
                this.comment.responses.push(this._ng_response);
            } else {
                this.comment.responses = this.comment.responses.map((response: ICommentResponse) => {
                    if (response.guid === this._ng_response.guid) {
                        response.modified = Date.now();
                        response.comment = comment;
                    }
                    return response;
                });
                this.controller.getSessionComments().update(this.comment);
            }
            this.controller.getSessionComments().update(this.comment);
        }
        this.ngOnResponseCancel();
    }

    public ngOnResponseCancel() {
        this._ng_response = undefined;
        this._forceUpdate();
    }

    public ngGetResponseEditCallback(response: ICommentResponse) {
        return () => {
            this._ng_response = Object.assign({}, response);
            this._forceUpdate();
        };
    }

    public ngGetResponseRemoveCallback(guid: string) {
        return () => {
            this.comment.responses = this.comment.responses.filter(r => r.guid !== guid);
            this.controller.getSessionComments().update(this.comment);
        };
    }

    public ngGetResponseColor(): string | undefined {
        return this.comment.color === undefined ? undefined : shadeColor(this.comment.color, -20);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

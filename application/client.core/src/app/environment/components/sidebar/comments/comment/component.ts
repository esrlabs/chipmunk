// tslint:disable: member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    OnChanges,
    SimpleChanges,
    ViewEncapsulation,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { Session } from '../../../../controller/session/session';
import {
    IComment,
    ICommentResponse,
} from '../../../../controller/session/dependencies/comments/session.dependency.comments.types';
import { CShortColors } from '../../../../conts/colors';
import { shadeColor } from '../../../../theme/colors';
import { EParent } from '../../../../services/standalone/service.output.redirections';

import * as Toolkit from 'chipmunk.client.toolkit';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';

@Component({
    selector: 'app-sidebar-app-comments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarAppCommentsItemComponent implements OnDestroy, AfterContentInit, OnChanges {
    @Input() comment!: IComment;
    @Input() controller!: Session;
    @Input() broadcastEditorUsage!: Subject<string>;

    public _ng_colors: string[] = CShortColors.slice();
    public _ng_response: ICommentResponse | undefined;

    private _guid: string = Toolkit.guid();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
        this.ngOnResponseSave = this.ngOnResponseSave.bind(this);
        this.ngOnResponseCancel = this.ngOnResponseCancel.bind(this);
        this.ngOnResponseRemove = this.ngOnResponseRemove.bind(this);
    }

    public ngAfterContentInit() {
        this._subscriptions.broadcastEditorUsage = this.broadcastEditorUsage
            .asObservable()
            .subscribe((guid: string) => {
                if (guid === this._guid) {
                    return;
                }
                this._ng_response = undefined;
            });
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
        OutputRedirectionsService.select(EParent.comment, this.controller.getGuid(), {
            output: this.comment.selection.start.position,
        });
    }

    public ngOnRemove() {
        setTimeout(() => {
            this.controller.getSessionComments().remove(this.comment.guid);
        }, 10);
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.comment === undefined) {
            return;
        }
        this.comment = Toolkit.copy(changes.comment.currentValue);
        this._forceUpdate();
    }

    public ngOnSetColor(color: string | undefined) {
        this.comment.color = color;
        this.controller.getSessionComments().update(this.comment);
        this._forceUpdate();
    }

    public ngOnReplay() {
        this._ng_response = {
            guid: '',
            created: Date.now(),
            modified: Date.now(),
            comment: '',
        };
        this.broadcastEditorUsage.next(this._guid);
        this._forceUpdate();
    }

    public ngOnResponseSave(comment: string) {
        if (this._ng_response === undefined) {
            return;
        }
        if (comment !== '') {
            if (this._ng_response.guid === '') {
                this._ng_response.guid = Toolkit.guid();
                this._ng_response.comment = comment;
                this.comment.responses.push(this._ng_response);
            } else {
                this.comment.responses = this.comment.responses.map(
                    (response: ICommentResponse) => {
                        if (response.guid === this._ng_response?.guid) {
                            response.modified = Date.now();
                            response.comment = comment;
                        }
                        return response;
                    },
                );
            }
            this.controller.getSessionComments().update(this.comment);
        }
        this.ngOnResponseCancel();
    }

    public ngOnResponseCancel() {
        this._ng_response = undefined;
        this._forceUpdate();
    }

    public ngOnResponseRemove() {
        if (this._ng_response === undefined) {
            return;
        }
        this.comment.responses = this.comment.responses.filter(
            (r) => r.guid !== this._ng_response?.guid,
        );
        this.controller.getSessionComments().update(this.comment);
        this.ngOnResponseCancel();
    }

    public ngGetResponseEditCallback(response: ICommentResponse) {
        return () => {
            this._ng_response = Object.assign({}, response);
            this.broadcastEditorUsage.next(this._guid);
            this._forceUpdate();
        };
    }

    public ngGetResponseRemoveCallback(guid: string) {
        return () => {
            this.comment.responses = this.comment.responses.filter((r) => r.guid !== guid);
            this.controller.getSessionComments().update(this.comment);
        };
    }

    public ngGetResponseColor(): string | undefined {
        return this.comment.color === undefined ? undefined : shadeColor(this.comment.color, -10);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

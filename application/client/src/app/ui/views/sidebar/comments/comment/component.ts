// tslint:disable: member-ordering

import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    OnChanges,
    SimpleChanges,
    ViewEncapsulation,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Definition, Response } from '@service/session/dependencies/comments/comment';
import { CShortColors, shadeColor } from '@ui/styles/colors';
import { Subject } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';
import { Owner } from '@schema/content/row';

import * as obj from '@platform/env/obj';

@Component({
    selector: 'app-views-comments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class Comment extends ChangesDetector implements AfterContentInit, OnChanges {
    @Input() comment!: Definition;
    @Input() session!: Session;
    @Input() broadcastEditorUsage!: Subject<string>;

    public colors: string[] = CShortColors.slice();
    public response: Response | undefined;

    protected uuid: string = unique();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.ngOnResponseSave = this.ngOnResponseSave.bind(this);
        this.ngOnResponseCancel = this.ngOnResponseCancel.bind(this);
        this.ngOnResponseRemove = this.ngOnResponseRemove.bind(this);
    }

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.broadcastEditorUsage.subscribe((uuid: string) => {
                if (uuid === this.uuid) {
                    return;
                }
                this.response = undefined;
                this.detectChanges();
            }),
        );
    }

    public ngOnEdit() {
        this.session.comments.edit(this.comment);
    }

    public ngOnShow() {
        this.session.cursor.select(
            this.comment.selection.start.position,
            Owner.Comment,
            undefined,
            undefined,
        );
    }

    public ngOnRemove() {
        this.session.comments.remove(this.comment.uuid);
    }

    public ngOnChanges(changes: SimpleChanges) {
        const change = changes as unknown as { comment: { currentValue: Definition } };
        if (change.comment === undefined) {
            return;
        }
        this.comment = obj.clone(change.comment.currentValue);
        this.detectChanges();
    }

    public ngOnSetColor(color: string | undefined) {
        this.comment.color = color;
        this.session.comments.update(this.comment);
        this.detectChanges();
    }

    public ngOnReplay() {
        this.response = {
            uuid: '',
            created: Date.now(),
            modified: Date.now(),
            comment: '',
        };
        this.broadcastEditorUsage.emit(this.uuid);
        this.detectChanges();
    }

    public ngOnResponseSave(comment: string) {
        if (this.response === undefined) {
            return;
        }
        if (comment !== '') {
            if (this.response.uuid === '') {
                this.response.uuid = unique();
                this.response.comment = comment;
                this.comment.responses.push(this.response);
            } else {
                this.comment.responses = this.comment.responses.map((response: Response) => {
                    if (response.uuid === this.response?.uuid) {
                        response.modified = Date.now();
                        response.comment = comment;
                    }
                    return response;
                });
            }
            this.session.comments.update(this.comment);
        }
        this.ngOnResponseCancel();
    }

    public ngOnResponseCancel() {
        this.response = undefined;
        this.detectChanges();
    }

    public ngOnResponseRemove() {
        if (this.response === undefined) {
            return;
        }
        this.comment.responses = this.comment.responses.filter(
            (r) => r.uuid !== this.response?.uuid,
        );
        this.session.comments.update(this.comment);
        this.ngOnResponseCancel();
    }

    public ngGetResponseEditCallback(response: Response) {
        return () => {
            this.response = Object.assign({}, response);
            this.broadcastEditorUsage.emit(this.uuid);
            this.detectChanges();
        };
    }

    public ngGetResponseRemoveCallback(uuid: string) {
        return () => {
            this.comment.responses = this.comment.responses.filter((r) => r.uuid !== uuid);
            this.session.comments.update(this.comment);
        };
    }

    public ngGetResponseColor(): string | undefined {
        return this.comment.color === undefined ? undefined : shadeColor(this.comment.color, -10);
    }
}
export interface Comment extends IlcInterface {}

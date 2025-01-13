import {
    Component,
    OnDestroy,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    ViewEncapsulation,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CommentDefinition } from '@platform/types/comment';
import { CShortColors } from '@ui/styles/colors';
import { Subscriber, Subject } from '@platform/env/subscription';

export enum ECommentsOrdering {
    position = 'position',
    colors = 'colors',
}

@Component({
    selector: 'app-views-comments',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Initial()
@Ilc()
export class Comments
    extends ChangesDetector
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    @Input() session: Session | undefined;

    protected update() {
        this.comments = this.origin
            .filter((c) => this.filter === undefined || this.filter === c.color)
            .map((c) => Object.assign({}, c));
        this.hidden = [];
        this.origin
            .filter((c) => this.filter !== undefined && this.filter !== c.color)
            .map((comment: CommentDefinition) => {
                const index: number = this.hidden.findIndex((d) => d.color === comment.color);
                if (index === -1) {
                    this.hidden.push({ count: 1, color: comment.color });
                } else {
                    this.hidden[index].count += 1;
                }
            });
        this.detectChanges();
    }

    protected onSessionChange(_uuid: string | undefined) {
        this.session = this.ilc().services.system.session.active().session();
        if (this.session !== undefined) {
            this.subscriber.unsubscribe();
            this.subscriber.register(
                this.session.comments.subjects.get().added.subscribe(this.reload.bind(this)),
                this.session.comments.subjects.get().updated.subscribe(this.reload.bind(this)),
                this.session.comments.subjects.get().removed.subscribe(this.reload.bind(this)),
                this.session.comments.subjects.get().reload.subscribe(this.reload.bind(this)),
            );
        }
        this.reload();
    }

    protected reload() {
        if (this.session === undefined) {
            this.origin = [];
            this.update();
            return;
        }
        let comments: CommentDefinition[] = [];
        const all: CommentDefinition[] = this.session.comments.getAsArray();
        switch (this.ordring) {
            case ECommentsOrdering.colors:
                (CShortColors.slice() as Array<string | undefined>)
                    .concat([undefined] as Array<string | undefined>)
                    .forEach((color: string | undefined) => {
                        const group: CommentDefinition[] = all.filter((c) => c.color === color);
                        group.sort((a: CommentDefinition, b: CommentDefinition) => {
                            return a.selection.start.position > b.selection.start.position ? 1 : -1;
                        });
                        comments = comments.concat(group);
                    });
                break;
            case ECommentsOrdering.position:
                all.sort((a: CommentDefinition, b: CommentDefinition) => {
                    return a.selection.start.position > b.selection.start.position ? 1 : -1;
                });
                comments = all;
                break;
        }
        this.origin = comments;
        this.update();
    }

    protected readonly subscriber: Subscriber = new Subscriber();
    protected filter: string | undefined;
    protected origin: CommentDefinition[] = [];

    public comments: CommentDefinition[] = [];
    public hidden: { count: number; color: string | undefined }[] = [];
    public broadcastEditorUsage: Subject<string> = new Subject<string>();
    public colors: string[] = CShortColors.slice();
    public ordring: ECommentsOrdering = ECommentsOrdering.position;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy() {
        this.subscriber.unsubscribe();
    }

    public ngAfterContentInit() {
        this.ilc().channel.session.change(this.onSessionChange.bind(this));
        this.onSessionChange(undefined);
        this.session !== undefined &&
            this.subscriber.register(
                this.session.teamwork.subjects.get().active.subscribe(() => {
                    this.detectChanges();
                }),
            );
    }

    public ngAfterViewInit() {
        this.reload();
    }

    public ngOnSetFilter(color: string | undefined) {
        this.filter = color;
        this.update();
    }

    public ngOnRemoveAll() {
        this.session !== undefined && this.session.comments.clear();
    }

    public ngOnCheckUpdates() {
        this.session !== undefined && this.session.teamwork.update();
    }

    public ngOnOrderingSwitch() {
        this.ordring =
            this.ordring === ECommentsOrdering.colors
                ? ECommentsOrdering.position
                : ECommentsOrdering.colors;
        this.reload();
    }

    public isAvailable(): boolean {
        if (this.session === undefined) {
            return false;
        }
        return (
            this.session.teamwork.repo().getActive() !== undefined &&
            this.session.teamwork.user().get() !== undefined
        );
    }
}
export interface Comments extends IlcInterface {}

import {
    Component,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ViewEncapsulation,
    ViewChild,
    AfterViewInit,
    Input,
    Output,
    EventEmitter,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Action } from '@service/recent/action';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HiddenFilter } from '@elements/filter.hidden/component';

import * as $ from '@platform/types/observe';

@Component({
    selector: 'app-recent-actions',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class RecentActions extends ChangesDetector implements AfterContentInit, AfterViewInit {
    @Input() public observe?: $.Observe;

    @Output() public applied: EventEmitter<void> = new EventEmitter();

    @ViewChild('filter') filter!: HiddenFilter;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.markChangesForCheck();
        this.state = new State(this, this.observe);
        this.env().subscriber.register(
            this.state.update.subscribe(() => {
                this.detectChanges();
            }),
        );
        if (this.observe !== undefined) {
            this.env().subscriber.register(
                this.observe.subscribe(() => {
                    this.state.reload();
                    this.detectChanges();
                }),
            );
        }
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.filter.filter.subjects.get().change.subscribe((value: string) => {
                this.state.filtering(value);
            }),
        );
        this.env().subscriber.register(
            this.filter.filter.subjects.get().drop.subscribe(() => {
                this.state.filtering('');
            }),
        );
    }

    public onDefaultAction(action: Action) {
        action.apply().catch((err: Error) => {
            this.log().error(`Fail to apply action: ${err.message}`);
        });
    }

    public onAllActions(event: MouseEvent, action: Action) {
        const items = [
            ...action.getActions(),
            {},
            {
                caption: 'Remove recent',
                handler: () => {
                    this.state.remove([action.uuid]);
                },
            },
            {
                caption: 'Clear All',
                handler: () => {
                    this.state.removeAll();
                },
            },
        ];
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
        });
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface RecentActions extends IlcInterface {}

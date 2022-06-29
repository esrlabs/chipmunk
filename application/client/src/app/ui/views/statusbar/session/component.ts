import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    ChangeDetectionStrategy,
    ViewEncapsulation,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session as ActiveSession } from '@service/session';
import { State } from './state';
import { Subscriber } from '@platform/env/subscription';

@Component({
    selector: 'app-statusbar-session',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Session extends ChangesDetector implements AfterViewInit, OnDestroy {
    private _subscriber: Subscriber = new Subscriber();
    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnDestroy(): void {
        this._subscriber.unsubscribe();
    }

    ngAfterViewInit(): void {
        this.ilc().channel.session.change(() => {
            this._bind();
        });
        this._bind();
    }

    private _bind() {
        this._subscriber.unsubscribe();
        !this.access().session((active: ActiveSession) => {
            this._subscriber.register(
                active.stream.subjects.get().updated.subscribe(() => {
                    this._update(active);
                }),
            );
            this._subscriber.register(
                active.search.subjects.get().updated.subscribe(() => {
                    this._update(active);
                }),
            );
            this._subscriber.register(
                active.cursor.subjects.get().updated.subscribe(() => {
                    this._update(active);
                }),
            );
            this._update(active);
        }) && this.state.drop();
        this.markChangesForCheck();
    }

    private _update(active: ActiveSession) {
        this.state.len = active.stream.len();
        this.state.found = active.search.len();
        const selection = active.cursor.get();
        this.state.pos = selection.length === 0 ? 0 : selection[0];
        this.state.selected = selection.length;
        this.detectChanges();
    }
}
export interface Session extends IlcInterface {}

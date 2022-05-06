import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    ChangeDetectionStrategy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Job } from '@service/jobs';

@Component({
    selector: 'app-statusbar-jobs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Jobs extends ChangesDetector implements AfterViewInit {
    private _session: string | undefined;
    public list: {
        globals: Job[];
        session: Job[];
        pinned: Job[];
    } = {
        globals: [],
        session: [],
        pinned: [],
    };
    public actual: {
        globals: Job | undefined;
        session: Job | undefined;
    } = {
        globals: undefined,
        session: undefined,
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit(): void {
        this.ilc().channel.session.change((session) => {
            this._session = session;
            this._update();
        });
        this.ilc().channel.backend.job(() => {
            this._update();
        });
        this._update();
    }

    private _update() {
        if (this._session === undefined) {
            this.list.session = [];
            this.actual.session = undefined;
        } else {
            this.list.session = this.ilc().services.system.jobs.session(this._session);
        }
        this.list.globals = this.ilc().services.system.jobs.globals();
        this.list.pinned = this.list.globals.filter((j) => j.pinned);
        this.list.pinned = this.list.pinned.concat(this.list.session.filter((j) => j.pinned));
        const regular = {
            session: this.list.session.filter((j) => !j.pinned),
            globals: this.list.globals.filter((j) => !j.pinned),
        };
        this.actual.session =
            regular.session.length > 0 ? regular.session[regular.session.length - 1] : undefined;
        this.actual.globals =
            regular.globals.length > 0 ? regular.globals[regular.globals.length - 1] : undefined;
        this.detectChanges();
    }
}
export interface Jobs extends IlcInterface {}

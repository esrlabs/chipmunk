import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    ChangeDetectionStrategy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
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
    public done: {
        globals: Job[];
        session: Job[];
    } = {
        globals: [],
        session: [],
    };
    public actual: {
        globals: Job[];
        session: Job[];
    } = {
        globals: [],
        session: [],
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
            this.done.session = [];
            this.actual.session = [];
        } else {
            const all = this.ilc().services.system.jobs.session(this._session);
            this.actual.session = all.filter((j) => !j.isDone());
            this.done.session = all.filter((j) => j.isDone());
        }
        const all = this.ilc().services.system.jobs.globals();
        this.actual.globals = all.filter((j) => !j.isDone());
        this.done.globals = all.filter((j) => j.isDone());
        this.detectChanges();
    }
}
export interface Jobs extends IlcInterface {}

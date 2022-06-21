import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    ChangeDetectionStrategy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { session } from '@service/session';
import { State } from './state';

@Component({
    selector: 'app-statusbar-session',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class Session extends ChangesDetector implements AfterViewInit {
    private _session: string | undefined;
    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.ilc().channel.session.stream.updated((event) => {
            if (this._session !== event.session) {
                return;
            }
            this._update();
        });
        this.ilc().channel.session.search.updated((event) => {
            if (this._session !== event.session) {
                return;
            }
            this._update();
        });
    }

    ngAfterViewInit(): void {
        this.ilc().channel.session.change((session) => {
            this._session = session;
            this._update();
        });
        this._update();
    }

    private _update() {
        const active = session.active().session();
        if (active === undefined) {
            this.state.drop();
        } else {
            this.state.len = active.stream.len();
            this.state.found = active.search.len();
        }
        this.detectChanges();
    }
}
export interface Session extends IlcInterface {}

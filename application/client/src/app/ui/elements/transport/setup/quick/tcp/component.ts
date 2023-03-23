import { Component, ChangeDetectorRef, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { SetupBase } from '../../bases/tcp/component';
import { State } from '../../states/tcp';
import { unique } from '@platform/env/sequence';
import { Session } from '@service/session';

const QUICK_TRANSPORT_STATE = unique();

@Component({
    selector: 'app-tcp-quicksetup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class QuickSetup extends SetupBase implements AfterContentInit {
    @Input() public session!: Session;

    public override state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public override ngOnDestroy(): void {
        this.session.storage.set(QUICK_TRANSPORT_STATE, this.state);
        super.ngOnDestroy();
    }

    public override ngAfterContentInit(): void {
        const stored = this.session.storage.get<State>(QUICK_TRANSPORT_STATE);
        this.state = stored === undefined ? new State() : stored;
        super.ngAfterContentInit();
    }

    public connect() {
        this.action.apply();
    }
}
export interface QuickSetup extends IlcInterface {}

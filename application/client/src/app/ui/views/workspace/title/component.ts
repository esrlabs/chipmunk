import { Component, Input, AfterContentInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Session } from '@service/session';
import { State } from './state';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { unique } from '@platform/env/sequence';

const TITLE_STATE = unique();

@Component({
    selector: 'app-views-workspace-title',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ViewWorkspaceTitleComponent
    extends ChangesDetector
    implements AfterContentInit, OnDestroy
{
    @Input() public session!: Session;

    public state!: State;
    public title!: string;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy().catch((err: Error) => {
            this.log().error(`Fail to drop state: ${err.message}`);
        });
        this.session.storage.set(TITLE_STATE, this.state);
    }

    public ngAfterContentInit(): void {
        const stored = this.session.storage.get<State>(TITLE_STATE);
        this.state = stored !== undefined ? stored : new State();
        this.state.bind(this, this.session);
    }
}
export interface ViewWorkspaceTitleComponent extends IlcInterface {}

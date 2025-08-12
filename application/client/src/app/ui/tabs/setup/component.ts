import {
    Component,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    Input,
    AfterViewInit,
    AfterContentInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State, IApi } from './state';
import { SessionOrigin } from '@service/session/origin';
import { session } from '@service/session';

@Component({
    selector: 'app-tabs-setup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
@Initial()
@Ilc()
export class SetupObserve
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() api!: IApi;
    @Input() origin!: SessionOrigin;
    /// Preselected parser
    @Input() parser: string | undefined;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.state = new State(this.origin, this.parser);
        this.state.load();
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.state.subjects.get().parsers.subscribe(() => {
                this.detectChanges();
            }),
            this.state.subjects.get().sources.subscribe(() => {
                this.detectChanges();
            }),
            this.state.subjects.get().updated.subscribe(() => {
                this.detectChanges();
            }),
            this.state.subjects.get().errorStateChange.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    public onStart() {
        const error = this.state.setSourceOrigin(this.origin);
        if (error instanceof Error) {
            this.log().debug(`Cannot start session, because: ${error.message}`);
            return;
        }
        this.api
            .finish(this.origin)
            .then((uuid: string) => {
                this.log().debug(`Session has been created: ${uuid}`);
            })
            .catch((err: Error) => {
                this.log().error(`Fail to create session: ${err.message}`);
            });
    }

    public onCancel() {
        this.api.cancel();
    }
}
export interface SetupObserve extends IlcInterface {}

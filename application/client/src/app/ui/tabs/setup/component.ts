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

    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
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
        );
    }
}
export interface SetupObserve extends IlcInterface {}

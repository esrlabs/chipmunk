import {
    Component,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    AfterViewInit,
    Input,
    AfterContentInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { TabControls } from '@service/session';
import { State } from './state';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-tabs-observe',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class TabObserve
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() observe!: Observe;
    @Input() tab!: TabControls;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.state = new State(this, this.observe);
        const state = this.tab.storage<State>().get();
        if (state !== undefined) {
            this.state = state;
        } else {
            this.tab.storage().set(this.state);
        }
    }

    public ngAfterViewInit(): void {
        // this.tab.setTitle(
        //     this.files.length === 1 ? this.files[0].name : `${this.files.length} PcapNG files`,
        // );
    }
}
export interface TabObserve extends IlcInterface {}

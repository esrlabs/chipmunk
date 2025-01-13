import {
    Component,
    AfterContentInit,
    Input,
    OnDestroy,
    AfterViewInit,
    ViewChild,
    ChangeDetectorRef,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { File } from '@platform/types/files';
import { State } from './state';
import { TabControls } from '@service/session';
import { HiddenFilter } from '@elements/filter.hidden/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-tabs-source-multiple-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class TabSourceMultipleFiles
    extends ChangesDetector
    implements AfterContentInit, OnDestroy, AfterViewInit
{
    @Input() files!: File[];
    @Input() tab!: TabControls;

    @ViewChild('filter') filter!: HiddenFilter;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        const state: State | undefined = this.tab.storage<State>().get();
        if (state) {
            this.state = state;
            this.state.restore(this);
        } else {
            this.state = new State();
            this.state.init(this, this.tab, this.files);
        }
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.filter.filter.subjects.get().change.subscribe((value: string) => {
                this.state.filter(value);
            }),
            this.filter.filter.subjects.get().drop.subscribe(() => {
                this.state.filter('');
            }),
        );
        this.ilc().services.ui.dropfiles.state().disable();
    }

    public ngOnDestroy() {
        this.tab.storage<State>().set(this.state);
        this.ilc().services.ui.dropfiles.state().enable();
    }
}
export interface TabSourceMultipleFiles extends IlcInterface {}

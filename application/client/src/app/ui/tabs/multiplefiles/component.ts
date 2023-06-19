import {
    Component,
    AfterContentInit,
    Input,
    OnDestroy,
    AfterViewInit,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { File } from '@platform/types/files';
import { State } from './state';
import { TabControls } from '@service/session';
import { HiddenFilter } from '@elements/filter.hidden/component';

@Component({
    selector: 'app-tabs-source-multiple-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceMultipleFiles implements AfterContentInit, OnDestroy, AfterViewInit {
    @Input() files!: File[];
    @Input() tab!: TabControls;

    @ViewChild('filter') filter!: HiddenFilter;

    public state!: State;

    public ngAfterContentInit() {
        const state: State | undefined = this.tab.storage<State>().get();
        if (state) {
            this.state = state;
            this.state.restore(this.ilc());
        } else {
            this.state = new State();
            this.state.init(this.ilc(), this.tab, this.files);
        }
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.filter.filter.subjects.get().change.subscribe((value: string) => {
                this.state.filter(value);
            }),
        );
        this.env().subscriber.register(
            this.filter.filter.subjects.get().drop.subscribe(() => {
                this.state.filter('');
            }),
        );
    }

    public ngOnDestroy() {
        this.tab.storage<State>().set(this.state);
    }
}
export interface TabSourceMultipleFiles extends IlcInterface {}

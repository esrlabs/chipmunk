import { Component, AfterContentInit, Input, HostListener, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { File } from '@platform/types/files';
import { State } from './state';
import { TabControls } from '@service/session';

@Component({
    selector: 'app-tabs-source-multiple-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceMultipleFiles implements AfterContentInit, OnDestroy {
    @Input() files!: File[];
    @Input() tab!: TabControls;

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        this.state.onKeydown(event);
    }

    public state!: State;

    public ngAfterContentInit() {
        const state: State | undefined = this.tab.storage<State>().get();
        if (state === undefined) {
            this.state = new State();
            this.tab.storage().set(this.state);
        } else {
            this.state = state;
        }
        this.state.init(this.ilc(), this.tab, this.files, this.log());
    }

    public ngOnDestroy() {
        this.tab.storage<State>().set(this.state);
    }
}
export interface TabSourceMultipleFiles extends IlcInterface {}

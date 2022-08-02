import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { TabControls } from '@service/session';
import { State } from './state';
import { SourceDefinition } from '@platform/types/transport';

@Component({
    selector: 'app-tabs-source-textstream',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceTextStream extends ChangesDetector implements AfterContentInit {

    @Input() done!: (options: { source: SourceDefinition }) => void;
    @Input() file!: File;
    @Input() tab!: TabControls;
    @Input() options: { source: SourceDefinition; } | undefined;

    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const state = this.tab.storage<State>().get();
        if (state !== undefined) {
            this.state = state;
        } else {
            this.tab.storage().set(this.state);
        }
        if (this.options !== undefined) {
            this.state.fromOptions(this.options);
        }
    }

    public ngOnConnect() {
        this.done(this.state.asOptions());
        this.tab.close();
    }

    public ngOnClose() {
        this.tab.close();
    }
}
export interface TabSourceTextStream extends IlcInterface {}

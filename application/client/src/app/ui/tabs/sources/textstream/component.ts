import { Component, ChangeDetectorRef, Input, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { TabControls } from '@service/session';
import { State } from './state';
import { SourceDefinition, Source as SourceRef } from '@platform/types/transport';
import { Action } from '../common/actions/action';

@Component({
    selector: 'app-tabs-source-textstream',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceTextStream extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() done!: (
        options: { source: SourceDefinition },
        cb: (err: Error | undefined) => void,
    ) => void;
    @Input() file!: File;
    @Input() tab!: TabControls;
    @Input() options:
        | { source: SourceDefinition | undefined; preselected: SourceRef | undefined }
        | undefined;

    public state: State = new State();
    public group: string | undefined;
    public action: Action = new Action();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.tab.storage<State>().set(this.state);
        this.action.destroy();
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
        this.env().subscriber.register(
            this.ilc().services.ui.lockers.unbound.subscribe(() => {
                if (this.ilc().services.ui.lockers.get(this.tab.uuid).length !== 0) {
                    this.group = this.tab.uuid;
                } else {
                    this.group = undefined;
                }
                this.detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().applied.subscribe(() => {
                this.done(this.state.asOptions(), (err: Error | undefined) => {
                    if (err === undefined) {
                        this.tab.close();
                        return;
                    }
                });
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().canceled.subscribe(() => {
                this.tab.close();
            }),
        );
    }
}
export interface TabSourceTextStream extends IlcInterface {}

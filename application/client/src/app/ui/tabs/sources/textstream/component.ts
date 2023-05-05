import { Component, ChangeDetectorRef, Input, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { TabControls } from '@service/session';
import { State } from './state';
import { SourceDefinition, Source as SourceRef } from '@platform/types/transport';
import { Action } from '../common/actions/action';
import { ParserName, Origin } from '@platform/types/observe';

@Component({
    selector: 'app-tabs-source-textstream',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceTextStream extends ChangesDetector implements AfterContentInit, OnDestroy {
    public readonly ParserName = ParserName;
    public readonly Origin = Origin;

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
    public errors: boolean = false;
    public action: Action = new Action();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.close = this.close.bind(this);
        this.defaultRecentAction = this.defaultRecentAction.bind(this);
    }

    public ngOnDestroy(): void {
        this.tab.storage<State>().set(this.state);
        this.state.destroy();
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
        this.action.setCaption('Run');
        this.errors = this.ilc().services.ui.lockers.get(this.tab.uuid).length > 0;
        this.env().subscriber.register(
            this.ilc().services.ui.lockers.unbound.subscribe(() => {
                this.errors = this.ilc().services.ui.lockers.get(this.tab.uuid).length > 0;
                this.detectChanges();
            }),
            this.action.subjects.get().applied.subscribe(() => {
                this.done(this.state.asOptions(), (err: Error | undefined) => {
                    if (err === undefined) {
                        this.tab.close();
                        return;
                    }
                });
            }),
            this.action.subjects.get().canceled.subscribe(() => {
                this.tab.close();
            }),
        );
    }

    public close() {
        this.tab.close();
    }

    public defaultRecentAction(source: SourceDefinition): boolean {
        this.state.update(source);
        this.detectChanges();
        return false;
    }
}
export interface TabSourceTextStream extends IlcInterface {}

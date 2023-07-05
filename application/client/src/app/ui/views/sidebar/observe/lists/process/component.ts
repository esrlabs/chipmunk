import { Component, ChangeDetectorRef, AfterContentInit, ViewChild } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Element } from '../../element/element';
import { Action } from '@ui/tabs/observe/action';
import { QuickSetup } from '@tabs/observe/stream/transport/setup/quick/process/component';
import { IButton } from '../../common/title/component';
import { State } from '../../states/process';
import { ListBase } from '../component';
import { Provider } from '@service/session/dependencies/observing/implementations/processes';

import * as Factroy from '@platform/types/observe/factory';

@Component({
    selector: 'app-views-observed-list-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class List extends ListBase<State, Provider> implements AfterContentInit {
    @ViewChild('quicksetupref') public quickSetupRef!: QuickSetup;

    public tailing: Element[] = [];
    public offline: Element[] = [];
    public action: Action = new Action();
    public buttons: IButton[] = [
        {
            icon: 'codicon-tasklist',
            handler: () => {
                this.provider.recent();
            },
        },
        {
            icon: 'codicon-empty-window',
            handler: () => {
                this.provider.openNewSessionOptions();
            },
        },
    ];

    constructor(cdRef: ChangeDetectorRef) {
        super(new State(), cdRef);
    }

    public override ngAfterContentInit(): void {
        super.ngAfterContentInit();
        this.update();
        this.env().subscriber.register(
            this.provider.subjects.get().updated.subscribe(() => {
                this.update().detectChanges();
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().apply.subscribe(() => {
                this.provider
                    .clone(
                        new Factroy.Stream()
                            .asText()
                            .process(this.quickSetupRef.state.configuration).observe,
                    )
                    .then(() => {
                        this.action.subjects.get().applied.emit();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to apply connection to Process: ${err.message}`);
                    });
            }),
        );
    }

    public toggled(opened: boolean) {
        this.state.toggleQuickSetup(opened);
    }

    protected update(): List {
        this.tailing = this.provider
            .sources()
            .filter((s) => s.observer !== undefined)
            .map((s) => new Element(s, this.provider));
        this.offline = this.provider
            .sources()
            .filter((s) => s.observer === undefined)
            .map((s) => new Element(s, this.provider));
        return this;
    }
}
export interface List extends IlcInterface {}

import { Component, ChangeDetectorRef, AfterContentInit, ViewChild } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Provider } from '@service/session/dependencies/observing/implementations/tcp';
import { Element } from '../../element/element';
import { QuickSetup } from '../../../../../elements/transport/setup/quick/tcp/component';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { IButton } from '../../common/title/component';
import { DataSource } from '@platform/types/observe';
import { components } from '@env/decorators/initial';
import { Vertical, Horizontal } from '@ui/service/popup';
import { State } from '../../states/tcp';
import { ListBase } from '../component';

@Component({
    selector: 'app-views-observed-list-tcp',
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
                const parser = this.provider.get().parser();
                const origin = this.provider.get().origin();
                if (parser instanceof Error || origin instanceof Error) {
                    return;
                }
                this.ilc().services.ui.popup.open({
                    component: {
                        factory: components.get('app-recent-actions-mini'),
                        inputs: {
                            parser,
                            origin,
                        },
                    },
                    position: {
                        vertical: Vertical.top,
                        horizontal: Horizontal.center,
                    },
                    closeOnKey: 'Escape',
                    width: 450,
                    uuid: 'app-recent-actions-popup-observed',
                });
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
                    .clone(DataSource.stream().tcp(this.quickSetupRef.state.asSourceDefinition()))
                    .then(() => {
                        this.action.subjects.get().applied.emit();
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to apply connection to TCP: ${err.message}`);
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

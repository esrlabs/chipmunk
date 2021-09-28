import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService, TabsOptions, ETabsListDirection } from 'chipmunk-client-material';
import { AreaState } from '../state';
import { Subscription, Subject, Observable } from 'rxjs';
import { LayoutSecondaryAreaControlsComponent } from './controls/component';
import { IComponentDesc } from 'chipmunk-client-material';
import { IChangeEvent } from '../../services/service.sessions.toolbar';

import ToolbarSessionsService from '../../services/service.sessions.toolbar';

@Component({
    selector: 'app-layout-area-secondary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutSecondaryAreaComponent implements AfterViewInit, OnDestroy {
    @Input() public state!: AreaState;

    public _ng_tabsService: TabsService | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};

    private _subjects: {
        injectionIntoTitleBar: Subject<IComponentDesc>;
    } = {
        injectionIntoTitleBar: new Subject<IComponentDesc>(),
    };

    constructor(private _cdRef: ChangeDetectorRef) {
        // Add common inputs for all tabs
        ToolbarSessionsService.setCommonInputs({
            injectionIntoTitleBar: this._subjects.injectionIntoTitleBar,
        });
        this._subscriptions.onTabServiceChange =
            ToolbarSessionsService.getObservable().change.subscribe(
                this._onTabServiceChange.bind(this),
            );
    }

    ngAfterViewInit() {
        this.state.maximize();
        this._setService(ToolbarSessionsService.getTabsService());
        this._subscriptions.minimized = this.state
            .getObservable()
            .minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state
            .getObservable()
            .updated.subscribe(this._onUpdated.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onTabsAreaClick() {
        if (!this.state.minimized) {
            return;
        }
        this.state.maximize();
    }

    private _onTabServiceChange(event: IChangeEvent | undefined) {
        this._setService(event === undefined ? undefined : event.service);
    }

    private _setService(service: TabsService | undefined) {
        if (service === undefined) {
            this._ng_tabsService = undefined;
        } else {
            // Set options area
            service.setOptions(
                new TabsOptions({
                    injections: {
                        bar: {
                            factory: LayoutSecondaryAreaControlsComponent,
                            inputs: {
                                state: this.state,
                                injection: this._getObservable().injectionIntoTitleBar,
                            },
                        },
                    },
                }),
            );
            this._ng_tabsService = service;
        }
        this._cdRef.detectChanges();
    }

    private _getObservable(): {
        injectionIntoTitleBar: Observable<IComponentDesc>;
    } {
        return {
            injectionIntoTitleBar: this._subjects.injectionIntoTitleBar.asObservable(),
        };
    }

    private _onMinimized(minimized: boolean) {
        this._cdRef.detectChanges();
    }

    private _onUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }
}

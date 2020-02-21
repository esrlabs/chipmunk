import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService, TabsOptions, ETabsListDirection } from 'chipmunk-client-material';
import { AreaState } from '../state';
import { Subscription, Subject, Observable } from 'rxjs';
import { LayoutSecondaryAreaControlsComponent } from './controls/component';
import ToolbarSessionsService from '../../services/service.sessions.toolbar';
import { IComponentDesc } from 'chipmunk-client-material';

@Component({
    selector: 'app-layout-area-secondary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutSecondaryAreaComponent implements AfterViewInit, OnDestroy {

    @Input() public state: AreaState;

    public tabsService: TabsService;

    private _subscriptions: {
        minimized: Subscription | null,
        updated: Subscription | null,
    } = {
        minimized: null,
        updated: null,
    };

    private _subjects: {
        injectionIntoTitleBar: Subject<IComponentDesc>,
    } = {
        injectionIntoTitleBar: new Subject<IComponentDesc>(),
    };

    constructor(private _cdRef: ChangeDetectorRef) {
        this.tabsService = ToolbarSessionsService.getTabsService();
    }

    ngAfterViewInit() {
        if (!(this.state)) {
            return;
        }
        this.state.maximize();
        // Add common inputs for all tabs
        ToolbarSessionsService.setCommonInputs({
            injectionIntoTitleBar: this._subjects.injectionIntoTitleBar,
        });
        // Set options area
        this.tabsService.setOptions(new TabsOptions({ injections: { bar: {
            factory: LayoutSecondaryAreaControlsComponent,
            inputs: {
                state: this.state,
                injection: this._getObservable().injectionIntoTitleBar
            }
        }}}));
        // Create default session
        ToolbarSessionsService.create();
        this._subscriptions.minimized = this.state.getObservable().minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state.getObservable().updated.subscribe(this._onUpdated.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    public _ng_onTabsAreaClick() {
        if (!this.state.minimized) {
            return;
        }
        this.state.maximize();
    }

    private _getObservable(): {
        injectionIntoTitleBar: Observable<IComponentDesc>
    } {
        return {
            injectionIntoTitleBar: this._subjects.injectionIntoTitleBar.asObservable()
        };
    }

    private _onMinimized(minimized: boolean) {
        this._cdRef.detectChanges();
    }

    private _onUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }
}

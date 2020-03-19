import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewEncapsulation } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { CommonInterfaces } from '../../../../interfaces/interface.common';
import { IPlugin } from '../../../../controller/controller.plugins.manager';
import { IDependencyState, CDependencies, getDependenciesStates, getDependenciesVersions } from '../../../../controller/helpers/versions';

enum EReadmeState {
    ready = 'ready',
    pending = 'pending',
    error = 'error',
}

@Component({
    selector: 'app-views-plugins-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class ViewPluginsDetailsComponent implements AfterContentInit, OnDestroy {

    @Input() public selected: Subject<IPlugin> = new Subject();

    public _ng_plugin: IPlugin | undefined;
    public _ng_state: EReadmeState = EReadmeState.pending;
    public _ng_error: string | undefined;
    public _ng_dependencies: IDependencyState[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef ) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.selected = this.selected.asObservable().subscribe(this._onPluginSelected.bind(this));
        if (this._ng_plugin !== undefined && (this._ng_plugin.readme === undefined || this._ng_plugin.readme.trim() === '')) {
            this._ng_state = EReadmeState.ready;
        }
    }

    public _ng_onLoad() {
        this._ng_state = EReadmeState.ready;
        this._forceUpdate();
    }

    public _ng_onError(event: Error) {
        this._ng_error = event.message;
        this._ng_state = EReadmeState.error;
    }

    private _onPluginSelected(plugin: IPlugin) {
        this._ng_plugin = plugin;
        this._ng_dependencies = getDependenciesStates(plugin.dependencies);
        if (this._ng_plugin !== undefined && (this._ng_plugin.readme === undefined || this._ng_plugin.readme.trim() === '')) {
            this._ng_state = EReadmeState.ready;
        } else {
            this._ng_state = EReadmeState.pending;
        }
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

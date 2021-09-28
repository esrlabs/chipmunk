import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { IPlugin } from '../../../../../controller/controller.plugins.manager';
import { Subscription } from 'rxjs';

import PluginsService from '../../../../../services/service.plugins';

@Component({
    selector: 'app-views-plugins-details-logs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewPluginsDetailsLogsComponent implements AfterContentInit, OnDestroy, OnChanges {
    @Input() public plugin!: IPlugin;

    public _ng_logs: string[] = [];
    public _ng_error: string | undefined;

    private _destroyed: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._request(this.plugin);
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.plugin === undefined) {
            return;
        }
        if (
            changes.plugin.previousValue !== undefined &&
            changes.plugin.previousValue.name === this.plugin.name
        ) {
            return;
        }
        this._request(changes.plugin.currentValue);
    }

    private _request(plugin: IPlugin) {
        PluginsService.getManager()
            .getLogs(plugin.name)
            .then((logs: string[]) => {
                this._ng_logs = logs;
                this._ng_error = undefined;
            })
            .catch((error: Error) => {
                this._ng_error = error.message;
                this._ng_logs = [];
            })
            .finally(() => {
                this._forceUpdate();
            });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

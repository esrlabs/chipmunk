import {
    Component,
    Input,
    OnDestroy,
    AfterViewInit,
    ChangeDetectorRef,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TabsService } from './service';
import { TabsOptions } from './options';

@Component({
    selector: 'element-tabs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TabsComponent implements OnDestroy, AfterViewInit, OnChanges {
    @Input() public service: TabsService | undefined;

    private _subscriptions: Map<string, Subscription> = new Map();
    private _destroyed: boolean = false;

    public _options: TabsOptions = new TabsOptions();

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterViewInit() {
        this._subscribe();
        this._getDefaultOptions();
    }

    ngOnDestroy() {
        this._destroyed = true;
        this._unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges) {
        this._subscribe();
        this._getDefaultOptions();
        this._forceUpdate();
    }

    private _subscribe() {
        this._unsubscribe();
        if (this.service === undefined) {
            return;
        }
        this._subscriptions.set(
            'options',
            this.service.getObservable().options.subscribe(this._onOptionsUpdated.bind(this)),
        );
    }

    private _unsubscribe() {
        this._subscriptions.forEach((subscription) => {
            subscription.unsubscribe();
        });
    }

    private async _getDefaultOptions() {
        if (this.service === undefined) {
            return;
        }
        this._options = await this.service.getOptions();
        this._forceUpdate();
    }

    private async _onOptionsUpdated(options: TabsOptions) {
        if (this.service === undefined) {
            return;
        }
        this._options = await options;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

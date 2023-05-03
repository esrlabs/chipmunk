import {
    Component,
    Input,
    OnDestroy,
    AfterViewInit,
    ChangeDetectorRef,
    OnChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TabsService } from './service';
import { TabsOptions } from './options';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'element-tabs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent extends ChangesDetector implements OnDestroy, AfterViewInit, OnChanges {
    @Input() public service: TabsService | undefined;

    private _subscriptions: Map<string, Subscription> = new Map();

    public _options: TabsOptions = new TabsOptions();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit() {
        this._subscribe();
        this._getDefaultOptions();
    }

    ngOnDestroy() {
        this._unsubscribe();
    }

    ngOnChanges() {
        this._subscribe();
        this._getDefaultOptions();
        this.detectChanges();
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
        this.detectChanges();
    }

    private async _onOptionsUpdated(options: TabsOptions) {
        if (this.service === undefined) {
            return;
        }
        this._options = await options;
        this.detectChanges();
    }
}

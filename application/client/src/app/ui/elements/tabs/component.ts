import {
    Component,
    Input,
    OnDestroy,
    AfterViewInit,
    ChangeDetectorRef,
    OnChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import { TabsService } from './service';
import { TabsOptions } from './options';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';

@Component({
    selector: 'element-tabs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
export class TabsComponent extends ChangesDetector implements OnDestroy, AfterViewInit, OnChanges {
    @Input() public service: TabsService | undefined;

    private _subscriber: Subscriber = new Subscriber();

    public _options: TabsOptions = new TabsOptions();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit() {
        this._subscribe();
        this._getDefaultOptions();
    }

    ngOnDestroy() {
        this._subscriber.unsubscribe();
    }

    ngOnChanges() {
        this._subscribe();
        this._getDefaultOptions();
        this.detectChanges();
    }

    private _subscribe() {
        this._subscriber.unsubscribe();
        if (this.service === undefined) {
            return;
        }
        this._subscriber.register(
            this.service.subjects.get().options.subscribe(this._onOptionsUpdated.bind(this)),
        );
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

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    ViewContainerRef,
    Input,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { IComponentDesc } from 'chipmunk-client-material';
import { IPlugin, IViewState } from '../../../controller/controller.plugins.manager';
import { Storage } from '../../../controller/helpers/virtualstorage';
import { ITabAPI } from '../../../services/service.sessions.tabs';

import PluginsService from '../../../services/service.plugins';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-plugins',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class TabPluginsComponent implements OnDestroy, AfterViewInit {
    @Input() public injectionIntoTitleBar!: Subject<IComponentDesc>;
    @Input() public onBeforeTabRemove!: Subject<void>;
    @Input() public setActiveTab!: (guid: string) => void;
    @Input() public getDefaultsTabGuids!: () => { charts: string };
    @Input() public onTitleContextMenu!: Observable<MouseEvent>;
    @Input() public getTabAPI!: ITabAPI;

    public _ng_selected: Subject<IPlugin> = new Subject<IPlugin>();
    //public _ng_recent: Observable<string[]>;
    public _ng_flags: {
        casesensitive: boolean;
        wholeword: boolean;
        regexp: boolean;
    } = {
        casesensitive: false,
        wholeword: false,
        regexp: true,
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewSearchComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _destroyed: boolean = false;
    private _resize: {
        p: number;
        x: number;
        r: number;
    } = {
        p: 0.5,
        x: -1,
        r: -1,
    };

    constructor(private _cdRef: ChangeDetectorRef, private _viewRef: ViewContainerRef) {
        window.addEventListener('mousemove', this._winMouseMove.bind(this));
        window.addEventListener('mouseup', this._winMouseUp.bind(this));
    }

    public ngAfterViewInit() {
        this._loadState();
        this._forceUpdate();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        window.removeEventListener('mousemove', this._winMouseMove);
        window.removeEventListener('mouseup', this._winMouseUp);
        this._saveState();
        this._destroyed = true;
    }

    public _ng_getViewDelimiterPosition(direction: 'left' | 'right') {
        return `${(direction === 'right' ? this._resize.p : 1 - this._resize.p) * 100}%`;
    }

    public _ng_getViewDelimiterClass(): string {
        return this._resize.x !== -1 ? 'delimiter dragging' : 'delimiter';
    }

    public _ng_onResizeStart(event: MouseEvent) {
        this._resize.x = event.x;
        this._resize.r =
            (this._viewRef.element.nativeElement as HTMLElement).getBoundingClientRect().width /
            100;
    }

    private _saveState() {
        const view: Storage<IViewState> = PluginsService.getManager().getStorage();
        view.set({ selected: view.get().selected, width: this._resize.p });
    }

    private _loadState() {
        const view: Storage<IViewState> = PluginsService.getManager().getStorage();
        this._resize.p = view.get().width;
    }

    private _winMouseMove(event: MouseEvent) {
        if (this._resize.x === -1) {
            return;
        }
        const change: number = (this._resize.x - event.x) / this._resize.r;
        this._resize.p += change / 100;
        if (this._resize.p < 0.25) {
            this._resize.p = 0.25;
        }
        if (this._resize.p > 0.75) {
            this._resize.p = 0.75;
        }
        this._resize.x = event.x;
        this._forceUpdate();
    }

    private _winMouseUp(event: MouseEvent) {
        if (this._resize.x === -1) {
            return;
        }
        this._resize.x = -1;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ViewChild,
} from '@angular/core';
import { FilterRequest } from '../../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { MatSelect } from '@angular/material/select';
import { Subject, Subscription } from 'rxjs';
import { CColors } from '../../../../../conts/colors';
import { RangeRequest } from '../../../../../controller/session/dependencies/search/dependencies/timeranges/controller.session.tab.search.ranges.request';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

type TColorType = 'color' | 'background';

interface IColorOption {
    title: string;
    value: TColorType;
}

@Component({
    selector: 'app-sidebar-app-searchmanager-timerange-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppSearchManagerTimerangeDetailsComponent
    implements OnDestroy, AfterContentInit
{
    @ViewChild(MatSelect) _refSelect!: MatSelect;

    @Input() provider!: Provider<RangeRequest>;

    public _ng_points: Entity<FilterRequest>[] = [];
    public _ng_end: Entity<FilterRequest> | undefined;
    public _ng_reorder: Subject<void> = new Subject();
    public _ng_selected: Subject<string> = new Subject();
    public _ng_requests: FilterRequest[] = [];
    public _ng_color: string | undefined;
    public _ng_strict: boolean | undefined;

    public _ng_currentColor: string | undefined;
    public _ng_colors: string[] = [];

    private _entity: Entity<RangeRequest> | undefined;
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
        this._subscriptions.selection = this.provider
            .getObservable()
            .selection.subscribe(this._init.bind(this));
        this._init();
    }

    public _ng_onColorChange(color: string) {
        const session = this.provider.getSession();
        if (this._entity === undefined || session === undefined) {
            return;
        }
        this._ng_color = color;
        this._entity.getEntity().setColor(this._ng_color);
        session.getTimestamp().setRangeColor(this._entity.getGUID(), this._ng_color);
        this._ng_currentColor = color;
        this._forceUpdate();
    }

    public _ng_onStrcitStateChange() {
        if (this._entity === undefined || this._ng_strict === undefined) {
            return;
        }
        this._entity.getEntity().setStrictState(this._ng_strict);
        this._forceUpdate();
    }

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this._ng_points = [];
            this._ng_end = undefined;
            this._ng_color = undefined;
            this._ng_currentColor = undefined;
            this._ng_strict = undefined;
        } else {
            const desc = this._entity.getEntity().asDesc();
            this._ng_points = this._entity
                .getEntity()
                .getPoints()
                .map((filter: FilterRequest) => {
                    return new Entity<FilterRequest>(filter, filter.getGUID());
                });
            this._ng_color = desc.color;
            this._ng_currentColor = desc.color;
            this._ng_strict = desc.strict;
            this._setColors();
        }
    }

    private _setColors() {
        this._ng_colors = CColors.slice();
        if (
            this._ng_color === undefined ||
            this._ng_colors.find((c) => c === this._ng_color) !== undefined
        ) {
            return;
        }
        this._ng_colors.push(this._ng_color);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

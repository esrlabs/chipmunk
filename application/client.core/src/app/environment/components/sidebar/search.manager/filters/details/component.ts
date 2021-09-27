import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { FilterRequest } from '../../../../../controller/session/dependencies/search/dependencies/filters/controller.session.tab.search.filters.request';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import { Subscription } from 'rxjs';
import { CColors } from '../../../../../conts/colors';
import { getContrastColor } from '../../../../../theme/colors';

type TColorType = 'color' | 'background';

interface IColorOption {
    title: string;
    value: TColorType;
}

@Component({
    selector: 'app-sidebar-app-searchmanager-filter-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarAppSearchManagerFilterDetailsComponent implements OnDestroy, AfterContentInit {
    @ViewChild(MatSelect) _refSelect!: MatSelect;

    @Input() provider!: Provider<FilterRequest>;

    public _ng_request: string | undefined;
    public _ng_color: string | undefined;
    public _ng_background: string | undefined;
    public _ng_colorOptions: IColorOption[] = [
        { title: 'Background', value: 'background' },
        { title: 'Foreground', value: 'color' },
    ];
    public _ng_colorType: TColorType = 'background';
    public _ng_currentColor: string | undefined;
    public _ng_colors: string[] = [];

    private _entity: Entity<FilterRequest> | undefined;
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
        this._subscriptions.change = this.provider
            .getObservable()
            .change.subscribe(this._onChange.bind(this));
        this._init();
    }

    public _ng_onColorTypeChange(event: MatSelectChange) {
        this._ng_colorType = event.value;
        switch (this._ng_colorType) {
            case 'color':
                this._ng_currentColor = this._ng_color;
                break;
            case 'background':
                this._ng_currentColor = this._ng_background;
                break;
        }
        this._refSelect.close();
        this._setColors();
        this._forceUpdate();
    }

    public _ng_onColorChange(color: string) {
        if (this._entity === undefined) {
            return;
        }
        switch (this._ng_colorType) {
            case 'color':
                this._ng_color = color;
                this._ng_background = getContrastColor(color, false);
                break;
            case 'background':
                this._ng_background = color;
                this._ng_color = getContrastColor(color, true);
                break;
        }
        this._entity.getEntity().setBackground(this._ng_background);
        this._entity.getEntity().setColor(this._ng_color);
        this._ng_currentColor = color;
        this._forceUpdate();
    }

    private _setColors() {
        this._ng_colors = CColors.slice();
        let color: string | undefined;
        switch (this._ng_colorType) {
            case 'color':
                color = this._ng_color;
                break;
            case 'background':
                color = this._ng_background;
                break;
        }
        if (color === undefined || this._ng_colors.find((c) => c === color) !== undefined) {
            return;
        }
        this._ng_colors.push(color);
        this._forceUpdate();
    }

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this._ng_request = undefined;
            this._ng_color = undefined;
            this._ng_background = undefined;
            this._ng_currentColor = undefined;
        } else {
            const desc = this._entity.getEntity().asDesc();
            this._ng_request = desc.request;
            this._ng_color = desc.color;
            this._ng_background = desc.background;
            this._ng_currentColor = desc.background;
            this._ng_colorType = 'background';
            this._setColors();
        }
        this._onChange();
    }

    private _onChange() {
        if (this._entity === undefined) {
            return;
        }
        this._ng_request = this._entity.getEntity().asDesc().request;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

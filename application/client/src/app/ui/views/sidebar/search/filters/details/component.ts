import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ViewChild,
    ChangeDetectionStrategy,
} from '@angular/core';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { MatSelectChange, MatSelect } from '@angular/material/select';
import { ProviderFilters } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { getContrastColor, CColors } from '@styles/colors';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

type TColorType = 'color' | 'background';

interface IColorOption {
    title: string;
    value: TColorType;
}

@Component({
    selector: 'app-sidebar-filters-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class FilterDetails extends ChangesDetector implements AfterContentInit {
    @ViewChild(MatSelect) _refSelect!: MatSelect;

    @Input() provider!: ProviderFilters;

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

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.provider.subjects.selection.subscribe(this._init.bind(this)),
        );
        this.env().subscriber.register(
            this.provider.subjects.change.subscribe(this._onChange.bind(this)),
        );
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
        this.detectChanges();
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
        this._entity.extract().set().background(this._ng_background);
        this._entity.extract().set().color(this._ng_color);
        this._ng_currentColor = color;
        this.detectChanges();
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
        this.detectChanges();
    }

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this._ng_request = undefined;
            this._ng_color = undefined;
            this._ng_background = undefined;
            this._ng_currentColor = undefined;
        } else {
            const def = this._entity.extract().definition;
            this._ng_request = def.filter.filter;
            this._ng_color = def.colors.color;
            this._ng_background = def.colors.background;
            this._ng_currentColor = def.colors.background;
            this._ng_colorType = 'background';
            this._setColors();
        }
        this._onChange();
    }

    private _onChange() {
        if (this._entity === undefined) {
            return;
        }
        this._ng_request = this._entity.extract().definition.filter.filter;
        this.detectChanges();
    }
}
export interface FilterDetails extends IlcInterface {}

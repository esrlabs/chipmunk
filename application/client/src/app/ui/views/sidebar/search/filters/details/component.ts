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
import { Ilc, IlcInterface } from '@env/decorators/component';
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

    public request: string | undefined;
    public color: string | undefined;
    public background: string | undefined;
    public colorOptions: IColorOption[] = [
        { title: 'Background', value: 'background' },
        { title: 'Foreground', value: 'color' },
    ];
    public colorType: TColorType = 'background';
    public currentColor: string | undefined;
    public colors: string[] = [];

    private _entity: Entity<FilterRequest> | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.provider.subjects.get().selection.subscribe(this._init.bind(this)),
        );
        this.env().subscriber.register(
            this.provider.subjects.get().change.subscribe(this._onChange.bind(this)),
        );
        this._init();
    }

    public _ng_onColorTypeChange(event: MatSelectChange) {
        this.colorType = event.value;
        switch (this.colorType) {
            case 'color':
                this.currentColor = this.color;
                break;
            case 'background':
                this.currentColor = this.background;
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
        switch (this.colorType) {
            case 'color':
                this.color = color;
                this.background = getContrastColor(color, false);
                break;
            case 'background':
                this.background = color;
                this.color = getContrastColor(color, true);
                break;
        }
        this._entity.extract().set().background(this.background);
        this._entity.extract().set().color(this.color);
        this.currentColor = color;
        this.detectChanges();
    }

    private _setColors() {
        this.colors = CColors.slice();
        let color: string | undefined;
        switch (this.colorType) {
            case 'color':
                color = this.color;
                break;
            case 'background':
                color = this.background;
                break;
        }
        if (color === undefined || this.colors.find((c) => c === color) !== undefined) {
            return;
        }
        this.colors.push(color);
        this.detectChanges();
    }

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this.request = undefined;
            this.color = undefined;
            this.background = undefined;
            this.currentColor = undefined;
        } else {
            const def = this._entity.extract().definition;
            this.request = def.filter.filter;
            this.color = def.colors.color;
            this.background = def.colors.background;
            this.currentColor = def.colors.background;
            this.colorType = 'background';
            this._setColors();
        }
        this._onChange();
    }

    private _onChange() {
        if (this._entity === undefined) {
            return;
        }
        this.request = this._entity.extract().definition.filter.filter;
        this.detectChanges();
    }
}
export interface FilterDetails extends IlcInterface {}

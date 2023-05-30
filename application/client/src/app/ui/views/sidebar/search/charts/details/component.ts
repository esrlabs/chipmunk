import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ChangeDetectionStrategy,
} from '@angular/core';
import { ChartRequest, ChartType } from '@service/session/dependencies/search/charts/request';
import { ProviderCharts } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { CColors, scheme_color_accent } from '@styles/colors';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-sidebar-charts-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class ChartrDetails extends ChangesDetector implements AfterContentInit {
    @Input() provider!: ProviderCharts;

    public request: string | undefined;
    public color: string = scheme_color_accent;
    public line: number = ChartRequest.DEFAULT_LINE_WIDTH;
    public point: number = ChartRequest.DEFAULT_POINT_RADIUS;
    public colors: string[] = [];
    public type: ChartType = ChartType.Linear;
    public types: ChartType[] = [ChartType.Linear, ChartType.Stepper, ChartType.Temperature];

    private _entity: Entity<ChartRequest> | undefined;

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

    public onColorChanges(color: string) {
        if (this._entity === undefined) {
            return;
        }
        this.color = color;
        this._entity.extract().set().color(this.color);
        this.detectChanges();
    }

    public onChartTypeChange() {
        if (this._entity === undefined) {
            return;
        }
        this._entity.extract().set().type(this.type);
        this.detectChanges();
    }

    public onLineChanges() {
        if (this._entity === undefined) {
            return;
        }
        this._entity.extract().set().line(this.line);
        this.detectChanges();
    }

    public onPointChanges() {
        if (this._entity === undefined) {
            return;
        }
        this._entity.extract().set().point(this.point);
        this.detectChanges();
    }

    private _setColors() {
        this.colors = CColors.slice();
        if (this.colors.find((c) => c === this.color) !== undefined) {
            return;
        }
        this.colors.push(this.color);
        this.detectChanges();
    }

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this.request = undefined;
            this.color = scheme_color_accent;
            this.type = ChartType.Linear;
        } else {
            const def = this._entity.extract().definition;
            this.request = def.filter;
            this.color = def.color;
            this.type = def.type;
            this._setColors();
        }
        this._onChange();
    }

    private _onChange() {
        if (this._entity === undefined) {
            return;
        }
        this.request = this._entity.extract().definition.filter;
        this.detectChanges();
    }
}
export interface ChartrDetails extends IlcInterface {}

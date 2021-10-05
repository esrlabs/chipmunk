import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    EventEmitter,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { ChartRequest } from '../../../../../controller/session/dependencies/search/dependencies/charts/controller.session.tab.search.charts.request';
import ChartControllers, {
    AChart,
    IOption,
    EOptionType,
    EChartType,
} from '../../../../views/chart/charts/charts';
import { IComponentDesc } from 'chipmunk-client-material';
import { MatSlider, MatSliderChange } from '@angular/material/slider';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import { Subscription } from 'rxjs';
import { CColors } from '../../../../../conts/colors';
import { MatSelectChange, MatSelect } from '@angular/material/select';

interface IOptionComponent {
    component: IComponentDesc;
    caption: string;
    value: any;
}

interface IChartTypeOption {
    title: string;
    value: EChartType;
}

const COptionComponents = {
    [EOptionType.slider]: MatSlider,
};

const CComponentsInputs = {
    [EOptionType.slider]: {
        thumbLabel: true,
        tickInterval: 1,
    },
};

@Component({
    selector: 'app-sidebar-app-searchmanager-chart-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarAppSearchManagerChartDetailsComponent implements OnDestroy, AfterContentInit {
    @ViewChild(MatSelect) _refSelect!: MatSelect;

    @Input() provider!: Provider<ChartRequest>;

    public _ng_request: string | undefined;
    public _ng_color: string | undefined;
    public _ng_type: EChartType | undefined;
    public _ng_types: IChartTypeOption[] = [
        { title: 'Stepped Line', value: EChartType.stepped },
        { title: 'Smooth Line', value: EChartType.smooth },
    ];
    public _ng_options: IOptionComponent[] = [];
    public _ng_colors: string[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _entity: Entity<ChartRequest> | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        const session = this.provider.getSession();
        session !== undefined &&
            session.getSessionSearch().getChartsAPI().selectBySource(undefined);
    }

    public ngAfterContentInit() {
        this._subscriptions.selection = this.provider
            .getObservable()
            .selection.subscribe(this._init.bind(this));
        this._init();
    }

    public _ng_onColorChange(color: string) {
        if (this._entity === undefined) {
            return;
        }
        this._ng_color = color;
        this._entity.getEntity().setColor(this._ng_color);
        this._forceUpdate();
    }

    public _ng_onChartTypeChange(event: MatSelectChange) {
        if (this._entity === undefined) {
            return;
        }
        this._ng_type = event.value;
        this._entity.getEntity().setType(event.value);
        this._refSelect.close();
        this._ng_options = this._getOptions();
        this._forceUpdate();
    }

    private _init() {
        this._entity = this.provider.select().single();
        if (this._entity === undefined) {
            this._ng_request = undefined;
            this._ng_color = undefined;
            this._ng_type = undefined;
            this._ng_options = [];
        } else {
            const desc = this._entity.getEntity().asDesc();
            this._ng_request = desc.request;
            this._ng_color = desc.color;
            this._ng_type = desc.type;
            this._ng_options = this._getOptions();
            this._setColors();
        }
        const session = this.provider.getSession();
        session !== undefined &&
            session.getSessionSearch().getChartsAPI().selectBySource(this._ng_request);
    }

    private _setColors() {
        this._ng_colors = CColors.slice();
        if (this._ng_colors.find((c) => c === this._ng_color) !== undefined) {
            return;
        }
        this._ng_color !== undefined && this._ng_colors.push(this._ng_color);
        this._forceUpdate();
    }

    private _getOptions(): IOptionComponent[] {
        if (this._entity === undefined) {
            return [];
        }
        const controller: AChart | undefined = ChartControllers[this._entity.getEntity().getType()];
        if (controller === undefined) {
            return [];
        }
        return controller
            .getOptions(this._entity.getEntity().getOptions())
            .map((option: IOption) => {
                // Create emitter
                const emitter: EventEmitter<MatSliderChange> = new EventEmitter<MatSliderChange>();
                // Create defaults inputs
                const inputs = Object.assign(
                    {
                        value: option.value,
                        change: emitter,
                    },
                    (CComponentsInputs as any)[option.type],
                );
                // Subscribe emitter
                this._subscriptions[`emitter_${option.name.replace(/\s/, '_')}`] = emitter
                    .asObservable()
                    .subscribe(this._onOptionChange.bind(this, controller, option));
                // Returns dynamic component description
                return {
                    component: {
                        factory: (COptionComponents as any)[option.type],
                        inputs: Object.assign(inputs, option.option),
                    },
                    caption: option.caption,
                    value: option.value,
                };
            });
    }

    private _onOptionChange(controller: AChart, option: IOption, event: MatSliderChange) {
        if (this._entity === undefined) {
            return;
        }
        option.value = event.value;
        // event.source.blur();
        this._entity
            .getEntity()
            .setOptions(controller.setOption(this._entity.getEntity().getOptions(), option));
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}

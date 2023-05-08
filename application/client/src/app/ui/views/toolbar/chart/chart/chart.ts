import {
    EChartName,
    ILabel,
    IPosition,
    EScaleType,
    EHasNoData,
    IScatterDataPointHolder,
} from '../common/types';
import {
    ChartDataset,
    ScatterDataPoint,
    Chart as CanvasChart,
    Interaction,
    InteractionOptions,
    InteractionModeFunction,
    ChartEvent,
    InteractionModeMap,
    ScriptableContext,
} from 'chart.js';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { IlcInterface } from '@service/ilc';
import { Session } from '@service/session';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { IRange } from '@platform/types/range';
import { Service } from '../service';
import { StoredEntity } from '@service/session/dependencies/search/store';
import { AnyObject } from 'chart.js/dist/types/basic';

declare module 'chart.js' {
    interface InteractionModeMap {
        myCustomMode: InteractionModeFunction;
    }
}

export class Chart {
    private readonly _session: Session;
    private readonly _parent: IlcInterface & ChangesDetector;
    private readonly _service: Service;
    private readonly _chart: CanvasChart;
    private readonly _labelState: ILabel;
    private _zoomedRange!: IRange;
    private _canvasWidth: number = 0;
    private _defaultPosition: IPosition = {
        full: this._canvasWidth,
        left: 0,
        width: this._canvasWidth,
    };
    private _injected: { [key: string]: ScatterDataPoint[] } = {};

    constructor(
        session: Session,
        parent: IlcInterface & ChangesDetector,
        service: Service,
        canvasWidth: number,
        labelState: ILabel,
    ) {
        this._session = session;
        this._parent = parent;
        this._service = service;
        this.canvasWidth = canvasWidth;
        this._labelState = labelState;
        this._chart = this._createChart();
        this._initSubscriptions();
        this._initDatasets();
        this._initData();
        this._restoreZoomedRange();
    }

    public set canvasWidth(canvasWidth: number) {
        this._canvasWidth = canvasWidth;
        this._defaultPosition = {
            full: this._canvasWidth,
            left: 0,
            width: this._canvasWidth,
        };
    }

    public get reverseScaleType(): EScaleType {
        const options = this._chart.options;
        if (
            options !== undefined &&
            options.scales !== undefined &&
            options.scales['y'] !== undefined
        ) {
            return options.scales['y'].type === EScaleType.linear
                ? EScaleType.logarithmic
                : EScaleType.linear;
        }
        return EScaleType.linear;
    }

    public destroy() {
        this._chart.destroy();
    }

    public switchScaleType() {
        const options = this._chart.options;
        if (
            options !== undefined &&
            options.scales !== undefined &&
            options.scales['y'] !== undefined
        ) {
            options.scales['y'].type = this.reverseScaleType;
        }
        this._chart.update();
    }

    public zoom(zoomedRange: IRange) {
        this._zoomedRange = zoomedRange;
        const options = this._chart.config.options;
        this._clearInject();
        if (options && options.scales && options.scales['x']) {
            this._inject(zoomedRange.from);
            this._inject(zoomedRange.to);
            options.scales['x'].min = zoomedRange.from;
            options.scales['x'].max = zoomedRange.to;
        }
        this._chart.update();
    }

    private _clearInject() {
        (this._chart.data.datasets as ChartDataset<'scatter', ScatterDataPoint[]>[]).forEach(
            (dataset) => {
                dataset.label !== undefined &&
                    this._injected[dataset.label] !== undefined &&
                    this._injected[dataset.label].forEach((injectedPoint: ScatterDataPoint) => {
                        dataset.data = dataset.data.filter(
                            (dataPoint: ScatterDataPoint) => dataPoint.x !== injectedPoint.x,
                        );
                    });
            },
        );
        this._injected = {};
    }

    private _inject(zoom: number) {
        (this._chart.data.datasets as ChartDataset<'scatter', ScatterDataPoint[]>[]).forEach(
            (dataset) => {
                if (
                    dataset.label === undefined ||
                    dataset.data.length === 0 ||
                    dataset.data[0].x > zoom ||
                    dataset.data[dataset.data.length - 1].x < zoom
                ) {
                    return;
                }
                const holder: IScatterDataPointHolder = {};
                dataset.data.every((point: ScatterDataPoint, index: number) => {
                    if (point.x < zoom) {
                        holder.previous = point;
                    } else if (holder.index === undefined && point.x > zoom) {
                        holder.upcoming = point;
                        holder.index = index;
                    }
                    return !(holder.index !== undefined);
                });
                if (
                    holder.previous !== undefined &&
                    holder.upcoming !== undefined &&
                    holder.index !== undefined &&
                    dataset.label !== undefined
                ) {
                    const point = this._getGapPoint(holder.previous, holder.upcoming, zoom);
                    if (this._injected[dataset.label] === undefined) {
                        this._injected[dataset.label] = [];
                    }
                    this._injected[dataset.label].push(point);
                    dataset.data.splice(holder.index, 0, point);
                }
            },
        );
    }

    private _getGapPoint(
        previousPoint: ScatterDataPoint,
        upcomingPoint: ScatterDataPoint,
        x: number,
    ): { x: number; y: number } {
        const x1 = previousPoint.x;
        const y1 = previousPoint.y;
        const x2 = upcomingPoint.x;
        const y2 = upcomingPoint.y;
        const y = ((y2 - y1) / (x2 - x1)) * x + (x2 * y1 - x1 * y2) / (x2 - x1);
        return { x: x, y: y };
    }

    private _initSubscriptions() {
        this._parent
            .env()
            .subscriber.register(
                this._session.search
                    .store()
                    .charts()
                    .subjects.get()
                    .highlights.subscribe(this._onChartColorChange.bind(this)),
                this._session.search
                    .store()
                    .charts()
                    .subjects.get()
                    .value.subscribe(this._onChange.bind(this)),
                this._session.search.values.updated.subscribe(this._valuesUpdated.bind(this)),
            );
    }

    private _onChange(entities: ChartRequest[]) {
        this._removeRedundantDatasets(entities);
        entities.forEach((entity: ChartRequest) => {
            if (entity.definition.active) {
                const index: number = this._chart.data.datasets.findIndex((dataset) => {
                    return dataset.label === entity.definition.filter;
                });
                if (index === -1) {
                    this._chart.data.datasets.push({
                        label: entity.definition.filter,
                        data: [],
                        backgroundColor: entity.definition.color,
                        borderColor: entity.definition.color,
                        stepped: entity.definition.stepped,
                        spanGaps: true,
                        borderWidth: entity.definition.borderWidth,
                        tension: entity.definition.tension,
                        pointRadius: entity.definition.pointRadius,
                    });
                    this._initData();
                } else {
                    const dataset = this._chart.data.datasets[index] as ChartDataset<
                        'scatter',
                        ScatterDataPoint[]
                    >;
                    dataset.stepped = entity.definition.stepped;
                    dataset.borderWidth = entity.definition.borderWidth;
                    dataset.tension = entity.definition.tension;
                    dataset.pointRadius = entity.definition.pointRadius;
                }
            }
        });
        this._chart.update();
        this._updateHasNoData();
    }

    private _removeRedundantDatasets(entities: ChartRequest[]) {
        this._chart.data.datasets = this._chart.data.datasets.filter((dataset) => {
            return (
                entities.findIndex((entity: ChartRequest) => {
                    return entity.definition.filter === dataset.label && entity.definition.active;
                }) !== -1
            );
        });
        Object.keys(this._injected).forEach((label) => {
            entities.forEach((entity: ChartRequest) => {
                entity.definition.filter === label && delete this._injected[label];
            });
        });
    }

    private _initDatasets() {
        this._chart.data.datasets = [];
        this._getActiveChartRequests().forEach((request: ChartRequest, index: number) => {
            this._injected[request.definition.filter] = [];
            this._chart.data.datasets[index] = {
                label: request.definition.filter,
                data: [],
                backgroundColor: request.definition.color,
                borderColor: request.definition.color,
                stepped: request.definition.stepped,
                spanGaps: true,
                borderWidth: request.definition.borderWidth,
                tension: request.definition.tension,
                pointHoverRadius: (ctx: ScriptableContext<'line'>, _options: AnyObject) => {
                    const injectedPoints = this._injected[request.definition.filter];
                    return injectedPoints === undefined
                        ? request.definition.pointRadius
                        : injectedPoints.findIndex(
                              (point: ScatterDataPoint) =>
                                  point.x === (ctx.raw as ScatterDataPoint).x,
                          ) === -1
                        ? request.definition.pointRadius
                        : 0;
                },
                pointRadius: (ctx: ScriptableContext<'line'>, _options: AnyObject) => {
                    const injectedPoints = this._injected[request.definition.filter];
                    return injectedPoints === undefined
                        ? request.definition.pointRadius
                        : injectedPoints.findIndex(
                              (point: ScatterDataPoint) =>
                                  point.x === (ctx.raw as ScatterDataPoint).x,
                          ) === -1
                        ? request.definition.pointRadius
                        : 0;
                },
            };
        });
    }

    private _initData() {
        if (this._getActiveChartRequests().length === 0) {
            this._updateHasNoData();
            return;
        }
        this._labelState.loading = true;
        for (const [line, values] of this._session.search.values.get()) {
            values.forEach((value: string, id: number) => {
                this._chart.data.datasets[id].data.push({
                    x: line,
                    y: parseInt(value),
                });
            });
        }
        this._labelState.loading = false;
        this._chart.update();
        this._updateHasNoData();
    }

    private _hideTooltipOnInserted() {
        Interaction.modes['myCustomMode'] = (
            chart: CanvasChart,
            event: ChartEvent,
            options: InteractionOptions,
            useFinalPosition: boolean | undefined,
        ) => {
            const pointItems = Interaction.modes.point(
                chart,
                event,
                { axis: 'x', intersect: true },
                useFinalPosition,
            );
            return pointItems.filter((pointItem) => {
                let isInjected: boolean = false;
                Object.values(this._injected).every((points: ScatterDataPoint[]) => {
                    points.every((point: ScatterDataPoint) => {
                        if (point.x === (pointItem.element as any).$context.raw.x) {
                            isInjected = true;
                        }
                        return !isInjected;
                    });
                    return !isInjected;
                });
                return !isInjected;
            });
        };
    }

    private _createChart(): CanvasChart {
        this._hideTooltipOnInserted();
        return new CanvasChart(`${EChartName.canvasCharts}-${this._session.uuid()}`, {
            type: 'scatter',
            data: {
                datasets: [],
            },
            options: {
                showLine: true,
                interaction: {
                    mode: 'myCustomMode' as keyof InteractionModeMap,
                },
                plugins: {
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        enabled: true,
                        animation: false,
                        callbacks: {
                            title: (tooltipItems) =>
                                `Line: ${
                                    tooltipItems.length === 0
                                        ? ''
                                        : (tooltipItems[0].raw as ScatterDataPoint).x ?? ''
                                }`,
                            label: (tooltipItem) => `${tooltipItem.parsed.y}`,
                        },
                    },
                },
                animation: {
                    duration: 0,
                },
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        display: false,
                    },
                    x: {
                        display: false,
                    },
                },
            },
        });
    }

    private _onChartColorChange(entities: ChartRequest[]) {
        entities.forEach((entity: ChartRequest) => {
            const entityColor: string = entity.definition.color;
            this._chart.data.datasets.forEach((dataset) => {
                if (dataset.label === entity.definition.filter) {
                    const uuid: string = entity.uuid();
                    const scales = this._chart.options.scales;
                    dataset.backgroundColor = entityColor;
                    dataset.borderColor = entityColor;
                    if (scales !== undefined) {
                        const scale = scales[uuid];
                        if (scale !== undefined && scale.ticks !== undefined) {
                            scale.ticks.color = entityColor;
                        }
                    }
                }
            });
        });
        this._chart.update();
    }

    private _restoreZoomedRange() {
        let position: IPosition | undefined = this._service.getPosition(this._session.uuid());
        const streamLength: number = this._session.stream.len();
        position ??= this._defaultPosition;
        this._zoomedRange = {
            from: Math.round((position.left / position.full) * streamLength),
            to: Math.round(((position.left + position.width) / position.full) * streamLength),
        };
        if (this._zoomedRange.to >= streamLength) {
            this._zoomedRange.to = streamLength - 1;
        }
        this.zoom(this._zoomedRange);
    }

    private _updateHasNoData() {
        this._labelState.hasNoData = true;
        this._chart.data.datasets.forEach((dataset) => {
            if (dataset.data.length > 0) {
                this._labelState.hasNoData = false;
            }
        });
        this._service.setHasNoData(EHasNoData.chart, this._labelState.hasNoData);
        this._parent.detectChanges();
    }

    private _getActiveChartRequests(): StoredEntity<ChartRequest>[] {
        return this._session.search
            .store()
            .charts()
            .get()
            .filter((entity: ChartRequest) => entity.definition.active);
    }

    private _valuesUpdated() {
        this._initDatasets();
        this._initData();
        this._restoreZoomedRange();
    }
}

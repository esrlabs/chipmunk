import { EChartName, ILabel, IPosition, EScaleType } from '../common/types';
import { ChartDataset, ScatterDataPoint, Chart as CanvasChart } from 'chart.js';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { IlcInterface } from '@service/ilc';
import { Session } from '@service/session';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { IRange } from '@platform/types/range';
import { Service } from '../service';
import { StoredEntity } from '@service/session/dependencies/search/store';

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
        const options = this._chart.config.options;
        if (
            options !== undefined &&
            options.scales !== undefined &&
            options.scales['x'] !== undefined
        ) {
            this._zoomedRange = zoomedRange;
            const labels: number[] | undefined = this._chart.config.data.labels as number[];
            const streamLength: number = this._session.stream.len();
            if (Array.isArray(labels) && labels.length > 0) {
                const from: number = Math.floor(
                    (labels.length - 1) * (this._zoomedRange.from / streamLength),
                );
                const to: number = Math.ceil(
                    (labels.length - 1) * (this._zoomedRange.to / streamLength),
                );
                options.scales['x'].min = from;
                options.scales['x'].max = to >= labels.length ? labels.length - 1 : to;
            }
        }
        this._chart.update();
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
            );
        this._parent
            .env()
            .subscriber.register(
                this._session.search
                    .store()
                    .charts()
                    .subjects.get()
                    .value.subscribe(this._onChange.bind(this)),
            );
        this._parent
            .env()
            .subscriber.register(
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
                    // const uuid: string = entity.uuid();
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
                        // yAxisID: uuid,
                    });
                    this._initData();
                } else {
                    const dataset = this._chart.data.datasets[index] as ChartDataset<
                        'line',
                        ScatterDataPoint[]
                    >;
                    dataset.stepped = entity.definition.stepped;
                    dataset.borderWidth = entity.definition.borderWidth;
                    dataset.tension = entity.definition.tension;
                    dataset.pointRadius = entity.definition.pointRadius;
                }
            }
        });
        // this._updateYAxes(entities);
        this._chart.update();
        this._updateHasNoData();
    }

    private _removeRedundantDatasets(entities: ChartRequest[]) {
        this._chart.data.datasets = (
            this._chart.data.datasets as ChartDataset<'line', ScatterDataPoint[]>[]
        ).filter((dataset: ChartDataset<'line', ScatterDataPoint[]>) => {
            return (
                entities.findIndex((entity: ChartRequest) => {
                    return entity.definition.filter === dataset.label && entity.definition.active;
                }) !== -1
            );
        });
    }

    private _initDatasets() {
        this._chart.data.datasets = [];
        this._getActiveChartRequests().forEach((request: ChartRequest, index: number) => {
            // const uuid: string = request.uuid();
            this._chart.data.datasets[index] = {
                label: request.definition.filter,
                data: [],
                backgroundColor: request.definition.color,
                borderColor: request.definition.color,
                stepped: request.definition.stepped,
                spanGaps: true,
                borderWidth: request.definition.borderWidth,
                tension: request.definition.tension,
                pointRadius: request.definition.pointRadius,
                // yAxisID: uuid,
            };
            // this._showYAxis(request);
        });
    }

    private _initData() {
        if (this._getActiveChartRequests().length === 0) {
            this._updateHasNoData();
            return;
        }
        this._labelState.loading = true;
        this._chart.data.labels = [];
        for (const [line, values] of this._session.search.values.get()) {
            values.forEach((sValue: string, id: number) => {
                const value: number = parseInt(sValue);
                const options = this._chart.config.options;
                if (options !== undefined && options.scales !== undefined) {
                    const scaleX = options.scales['x'];
                    if (scaleX !== undefined) {
                        if (typeof scaleX.min === 'number' && line < scaleX.min) {
                            scaleX.min = line;
                        } else if (typeof scaleX.max === 'number' && line > scaleX.max) {
                            scaleX.max = scaleX.min === line ? line + 1 : line;
                        }
                    }
                    const labels = this._chart.config.data.labels;
                    Array.isArray(labels) && labels.push(line);
                    this._chart.data.datasets[id].data.push({ x: line, y: value });
                }
            });
            if (Array.isArray(this._chart.data.labels)) {
                this._chart.data.labels = [...new Set(this._chart.data.labels as number[])].sort(
                    (a, b) => a - b,
                );
            }
        }
        this._labelState.loading = false;
        this._chart.update();
        this._updateHasNoData();
    }

    // Postponed due to overlapping with filters canvas
    // private _showYAxis(request: ChartRequest) {
    //     const uuid: string = request.uuid();
    //     this._chart.update();
    //     if (
    //         this._chart.options.scales !== undefined &&
    //         this._chart.options.scales[uuid] !== undefined
    //     ) {
    //         const yAxis = this._chart.options.scales[uuid] as ScaleOptionsByType<
    //             'radialLinear' | keyof CartesianScaleTypeRegistry
    //         >;
    //         yAxis.display = ChartsService.selectedGuid === uuid;
    //         yAxis.ticks.color = request.definition.color;
    //     }
    // }

    // Postponed due to overlapping with filters canvas
    // private _updateYAxes(entities: ChartRequest[]) {
    //     this._chart.update();
    //     const selectedUuid: string = ChartsService.selectedGuid;
    //     Object.keys(
    //         this._chart.options.scales as {
    //             [key: string]: ScaleOptionsByType<
    //                 'radialLinear' | keyof CartesianScaleTypeRegistry
    //             >;
    //         },
    //     ).forEach((axis: string) => {
    //         if (axis === 'x' || axis === 'y') {
    //             return;
    //         }
    //         const entity: ChartRequest | undefined = entities.find(
    //             (entity: ChartRequest) => entity.uuid() === axis,
    //         );
    //         if (this._chart.options !== undefined && this._chart.options.scales !== undefined) {
    //             if (entity === undefined) {
    //                 delete this._chart.options.scales[axis];
    //             } else {
    //                 const scale = this._chart.options.scales[axis];
    //                 if (scale !== undefined) {
    //                     scale.display = axis === selectedUuid && entity.definition.active;
    //                 }
    //             }
    //         }
    //     });
    // }

    private _createChart(): CanvasChart {
        return new CanvasChart(`${EChartName.canvasCharts}-${this._session.uuid()}`, {
            type: 'line',
            data: {
                labels: [],
                datasets: [],
            },
            options: {
                interaction: {
                    intersect: false,
                    mode: 'index',
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
                    },
                },
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        display: false,
                        stacked: true,
                        beginAtZero: true,
                    },
                    x: {
                        stacked: true,
                        display: false,
                    },
                },
            },
        });
    }

    private _onChartColorChange(entities: ChartRequest[]) {
        entities.forEach((entity: ChartRequest) => {
            const entityColor: string = entity.definition.color;
            (this._chart.data.datasets as ChartDataset<'line', ScatterDataPoint[]>[]).forEach(
                (dataset: ChartDataset<'line', ScatterDataPoint[]>) => {
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
                },
            );
        });
        this._chart.update();
    }

    private _onChartSelected(uuid: string) {
        uuid = uuid.trim();
        if (
            this._chart.options.scales === undefined ||
            (uuid !== '' && this._chart.options.scales[uuid] === undefined)
        ) {
            return;
        }
        const scales = this._chart.options.scales;
        Object.keys(scales).forEach((axis: string) => {
            const scale = scales[axis];
            if (scale !== undefined) {
                scale.display = axis === uuid;
            }
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
        (this._chart.data.datasets as ChartDataset<'line', ScatterDataPoint[]>[]).forEach(
            (dataset: ChartDataset<'line', ScatterDataPoint[]>) => {
                if (dataset.data.length > 0) {
                    this._labelState.hasNoData = false;
                }
            },
        );
        this._parent.detectChanges();
    }

    private _getActiveChartRequests(): StoredEntity<ChartRequest>[] {
        return Array.from(
            this._session.search
                .store()
                .charts()
                .get()
                .filter((entity: ChartRequest) => entity.definition.active),
        );
    }

    private _valuesUpdated() {
        this._initDatasets();
        this._initData();
        this._restoreZoomedRange();
    }
}

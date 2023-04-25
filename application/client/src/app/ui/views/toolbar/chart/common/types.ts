export interface IPosition {
    left: number;
    width: number;
    full: number;
}

export interface IPositionChange {
    readonly session: string;
    readonly position: IPosition | undefined;
}

export enum EChartName {
    canvasFilters = 'view-chart-canvas-filters',
    canvasCharts = 'view-chart-canvas-charts',
    zoomerFilters = 'view-chart-zoomer-filters',
    zoomerCharts = 'view-chart-zoomer-charts',
}

export interface IRectangle {
    width: number;
    left: number;
}

export interface ILabel {
    hasNoData: boolean;
    loading: boolean;
}

export interface ILabelState {
    filter: ILabel;
    chart: ILabel;
}

export enum EScaleType {
    linear = 'linear',
    logarithmic = 'logarithmic',
}

export const UPDATE_TIMEOUT_MS: number = 100;

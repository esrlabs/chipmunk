import { IValuesMap, IValuesMinMaxMap } from '@platform/interfaces/interface.rust.api.general';
import { scheme_color_0, scheme_color_5_75, shadeColor } from '@styles/colors';
import { Base } from './render';
import { ChartRequest, ChartType } from '@service/session/dependencies/search/charts/request';
import { ChartCoors } from './chart.coors';
import { IRange } from '@platform/types/range';

const GRID_LINES_COUNT = 5;

export class Render extends Base {
    protected values: IValuesMap = {};
    protected peaks: IValuesMinMaxMap = {};
    protected charts: ChartRequest[] = [];
    protected points: boolean = true;
    protected selected: number | undefined;

    protected yAxisRender(): void {
        if (this.selected === undefined) {
            return;
        }
        const selected = this.values[this.selected];
        const peaks = this.peaks[this.selected];
        if (selected === undefined || peaks === undefined) {
            return;
        }
        const min = peaks[0];
        const diff = peaks[1] - min;
        const size = this.size();
        this.context.beginPath();
        const step = Math.floor(size.height / GRID_LINES_COUNT);
        for (let s = 0; s <= GRID_LINES_COUNT; s += 1) {
            const y = s * step + (s === GRID_LINES_COUNT ? -0.5 : 0.5);
            this.context.moveTo(0, y);
            this.context.lineTo(size.width, y);
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = scheme_color_0;
        this.context.setLineDash([1, 1]);
        this.context.stroke();
        this.context.closePath();
        this.context.fillStyle = scheme_color_0;
        this.context.font = '10px sans-serif';
        this.context.textAlign = 'right';
        const diffStep = diff / GRID_LINES_COUNT;
        for (let s = 0; s <= GRID_LINES_COUNT; s += 1) {
            const y = s * step;
            const text = (min + diffStep * (GRID_LINES_COUNT - s)).toFixed(2);
            const box = this.context.measureText(text);
            let yOffset = -2;
            this.context.fillStyle = scheme_color_5_75;
            if (s === 0) {
                this.context.textBaseline = 'top';
                yOffset = 2;
                this.context.fillRect(size.width - 18 - box.width - 6, y, box.width + 12, 16);
            } else {
                this.context.textBaseline = 'bottom';
                this.context.fillRect(size.width - 18 - box.width - 6, y - 16, box.width + 12, 16);
            }
            this.context.fillStyle = scheme_color_0;
            this.context.fillText(text, size.width - 18, y + yOffset);
        }
        this.context.setLineDash([]);
    }

    public readonly coors: ChartCoors = new ChartCoors();

    public ignorePoints(): Render {
        this.points = false;
        return this;
    }

    public setSelected(index: number | undefined): Render {
        this.selected = index;
        return this;
    }

    public setValues(values: IValuesMap): Render {
        this.values = values;
        return this;
    }

    public setPeaks(peaks: IValuesMinMaxMap): Render {
        this.peaks = peaks;
        return this;
    }

    public setCharts(charts: ChartRequest[]): Render {
        this.charts = charts;
        return this;
    }

    public render(): void {
        const frame = this.frame;
        if (frame === undefined) {
            return;
        }
        if (frame.to - frame.from <= 0) {
            return;
        }
        this.coors.drop();
        const size = this.size();
        (Object.keys(this.values) as unknown as number[]).forEach((k: number) => {
            const peaks = this.peaks[k];
            if (peaks === undefined) {
                console.error(`No peaks for chart #${k}`);
                return;
            }
            const chart = this.charts[k];
            const type = chart === undefined ? ChartType.Linear : chart.definition.type;
            const render = this.modes(frame, peaks, this.values[k], size, chart);
            switch (type) {
                case ChartType.Linear:
                    render.linear();
                    break;
                case ChartType.Stepper:
                    render.stepper();
                    break;
                case ChartType.Temperature:
                    render.temperature();
                    break;
            }
        });
        this.yAxisRender();
    }

    protected modes(
        frame: IRange,
        peaks: [number, number],
        values: [number, number, number, number][],
        size: {
            width: number;
            height: number;
        },
        chart: ChartRequest | undefined,
    ): {
        linear(): void;
        stepper(): void;
        temperature(): void;
    } {
        const rate = {
            byX: size.width / (frame.to - frame.from),
            byY: size.height / (peaks[1] - peaks[0]),
        };
        return {
            linear: (): void => {
                this.context.beginPath();
                const coors: [number, number][] = [];
                values.forEach((pair: [number, number, number, number], i: number) => {
                    const position = pair[0];
                    const value = pair[3];
                    const x = Math.round((position - frame.from) * rate.byX);
                    const y = size.height - Math.round((value - peaks[0]) * rate.byY);
                    if (i === 0) {
                        this.context.moveTo(x, y);
                    } else {
                        this.context.lineTo(x, y);
                    }
                    coors.push([x, y]);
                    this.coors.add(x, value, position, pair[1], pair[2], chart);
                });
                const color = chart === undefined ? scheme_color_0 : chart.definition.color;
                const lineWidth =
                    chart === undefined
                        ? ChartRequest.DEFAULT_LINE_WIDTH
                        : chart.definition.widths.line;
                this.context.lineWidth = lineWidth;
                this.context.strokeStyle = color;
                this.context.stroke();
                this.context.closePath();
                const pointRadius =
                    chart === undefined
                        ? ChartRequest.DEFAULT_POINT_RADIUS
                        : chart.definition.widths.point;
                if (!this.points || pointRadius === 0) {
                    return;
                }
                coors.forEach((coors: [number, number]) => {
                    this.context.beginPath();
                    this.context.arc(coors[0], coors[1], pointRadius, 0, Math.PI * 2, true);
                    this.context.fillStyle = color;
                    this.context.fill();
                    this.context.closePath();
                });
            },
            stepper: (): void => {
                this.context.beginPath();
                const coors: [number, number][] = [];
                let prevY = 0;
                values.forEach((pair: [number, number, number, number], i: number) => {
                    const position = pair[0];
                    const value = pair[3];
                    const x = Math.round((position - frame.from) * rate.byX);
                    const y = size.height - Math.round((value - peaks[0]) * rate.byY);
                    if (i === 0) {
                        this.context.moveTo(x, y);
                    } else {
                        this.context.lineTo(x, prevY);
                        this.context.lineTo(x, y);
                    }
                    prevY = y;
                    coors.push([x, y]);
                    this.coors.add(x, value, position, pair[1], pair[2], chart);
                });
                const color = chart === undefined ? scheme_color_0 : chart.definition.color;
                const lineWidth =
                    chart === undefined
                        ? ChartRequest.DEFAULT_LINE_WIDTH
                        : chart.definition.widths.line;
                this.context.lineWidth = lineWidth;
                this.context.strokeStyle = color;
                this.context.stroke();
                this.context.closePath();
                const pointRadius =
                    chart === undefined
                        ? ChartRequest.DEFAULT_POINT_RADIUS
                        : chart.definition.widths.point;
                if (!this.points || pointRadius === 0) {
                    return;
                }
                coors.forEach((coors: [number, number]) => {
                    this.context.beginPath();
                    this.context.arc(coors[0], coors[1], pointRadius, 0, Math.PI * 2, true);
                    this.context.fillStyle = color;
                    this.context.fill();
                    this.context.closePath();
                });
            },
            temperature: (): void => {
                this.context.beginPath();
                const coors: [number, number][] = [];
                const start = { x: 0, y: 0 };
                const end = { x: 0, y: 0 };
                values.forEach((pair: [number, number, number, number], i: number) => {
                    const position = pair[0];
                    const value = pair[3];
                    const x = Math.round((position - frame.from) * rate.byX);
                    const y = size.height - Math.round((value - peaks[0]) * rate.byY);
                    if (i === 0) {
                        this.context.moveTo(x, y);
                        start.x = x;
                        start.y = y;
                    } else {
                        this.context.lineTo(x, y);
                    }
                    if (i === values.length - 1) {
                        end.x = x;
                        end.y = y;
                    }
                    coors.push([x, y]);
                    this.coors.add(x, value, position, pair[1], pair[2], chart);
                });
                const color = chart === undefined ? scheme_color_0 : chart.definition.color;
                const lineWidth =
                    chart === undefined
                        ? ChartRequest.DEFAULT_LINE_WIDTH
                        : chart.definition.widths.line;
                this.context.lineWidth = lineWidth;
                this.context.strokeStyle = color;
                this.context.stroke();
                this.context.lineTo(end.x, size.height);
                this.context.lineTo(start.x, size.height);
                this.context.lineTo(start.x, start.y);
                this.context.closePath();
                const wHalf = Math.round(size.width / 2);
                const gradient = this.context.createLinearGradient(wHalf, 0, wHalf, size.height);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, shadeColor(color, 200));
                this.context.fillStyle = gradient;
                this.context.fill();
                const pointRadius =
                    chart === undefined
                        ? ChartRequest.DEFAULT_POINT_RADIUS
                        : chart.definition.widths.point;
                if (!this.points || pointRadius === 0) {
                    return;
                }
                coors.forEach((coors: [number, number]) => {
                    this.context.beginPath();
                    this.context.arc(coors[0], coors[1], pointRadius, 0, Math.PI * 2, true);
                    this.context.fillStyle = color;
                    this.context.fill();
                    this.context.closePath();
                });
            },
        };
    }
}

import { IValuesMap, IValuesMinMaxMap } from '@platform/interfaces/interface.rust.api.general';
import { scheme_color_0, scheme_color_5_75 } from '@styles/colors';
import { Base } from './render';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ChartCoors } from './chart.coors';

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
        for (let s = 0; s < GRID_LINES_COUNT; s += 1) {
            const y = s * step;
            this.context.moveTo(0, y + 0.5);
            this.context.lineTo(size.width, y + 0.5);
        }
        this.context.lineWidth = 1;
        this.context.strokeStyle = scheme_color_0;
        this.context.setLineDash([1, 1]);
        this.context.stroke();
        this.context.closePath();
        this.context.fillStyle = scheme_color_0;
        this.context.font = '10px sans-serif';
        this.context.textAlign = 'right';
        for (let s = 0; s <= GRID_LINES_COUNT; s += 1) {
            const y = s * step;
            const text = (min + diff / (s + 1)).toFixed(2);
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
        this.coors.drop();
        (Object.keys(this.values) as unknown as number[]).forEach((k: number) => {
            const peaks = this.peaks[k];
            if (peaks === undefined) {
                console.error(`No peaks for chart #${k}`);
                return;
            }
            const values = this.values[k];
            const size = this.size();
            const rate = {
                byX: size.width / (frame.to - frame.from),
                byY: size.height / (peaks[1] - peaks[0]),
            };
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
                this.coors.add(x, value, position, this.charts[k]);
            });
            const color =
                this.charts[k] === undefined ? scheme_color_0 : this.charts[k].definition.color;
            const lineWidth =
                this.charts[k] === undefined
                    ? ChartRequest.DEFAULT_LINE_WIDTH
                    : this.charts[k].definition.widths.line;
            this.context.lineWidth = lineWidth;
            this.context.strokeStyle = color;
            this.context.stroke();
            this.context.closePath();
            const pointRadius =
                this.charts[k] === undefined
                    ? ChartRequest.DEFAULT_POINT_RADIUS
                    : this.charts[k].definition.widths.point;
            if (!this.points || pointRadius === 0) {
                return;
            }
            coors.forEach((pair: [number, number]) => {
                this.context.beginPath();
                this.context.arc(pair[0], pair[1], pointRadius, 0, Math.PI * 2, true);
                this.context.fillStyle = color;
                this.context.fill();
                this.context.closePath();
            });
        });
        this.yAxisRender();
    }
}

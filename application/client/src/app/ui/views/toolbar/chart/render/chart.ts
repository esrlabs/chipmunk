import { IValuesMap, IValuesMinMaxMap } from '@platform/interfaces/interface.rust.api.general';
import { scheme_color_0 } from '@styles/colors';
import { Base } from './render';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { ChartCoors } from './chart.coors';

export class Render extends Base {
    protected values: IValuesMap = {};
    protected peaks: IValuesMinMaxMap = {};
    protected charts: ChartRequest[] = [];
    protected points: boolean = true;

    public readonly coors: ChartCoors = new ChartCoors();

    public ignorePoints(): Render {
        this.points = false;
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
    }
}

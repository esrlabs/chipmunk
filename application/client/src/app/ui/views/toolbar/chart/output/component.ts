import { Component, AfterViewInit, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { OutputBase } from '../base/component';
import { Render as ChartsRender } from '../render/chart';
import { Render as FiltersRender } from '../render/filters';
import { State } from '../state';
import { stop } from '@ui/env/dom';
import { TChartValues } from '../render/chart.coors';
import { getContrastColor } from '@styles/colors';
import { Owner } from '@schema/content/row';
import { IRange } from '@platform/types/range';

const MAX_LABELS_COUNT = 5;

@Component({
    selector: 'app-views-chart-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewChartOutput extends OutputBase implements AfterViewInit {
    protected renders!: {
        charts: ChartsRender;
        filters: FiltersRender;
    };

    @HostListener('mousemove', ['$event']) mousemove(event: MouseEvent): void {
        this.labels = this.renders.charts.coors.get(event.offsetX);
        if (this.labels.length > MAX_LABELS_COUNT) {
            this.cutted = this.labels.splice(MAX_LABELS_COUNT, this.labels.length).length;
        } else {
            this.cutted = 0;
        }
        this.x = `${event.offsetX}px`;
        this.range = this.state.cursor.rowsRangeByX(event.offsetX);
        this.detectChanges();
    }

    @HostListener('mouseleave', ['$event']) mouseleave(_event: MouseEvent): void {
        this.x = undefined;
        this.detectChanges();
    }

    @HostListener('click', ['$event']) click(event: MouseEvent): void {
        const labels = this.renders.charts.coors.get(event.offsetX);
        if (labels.length === 0) {
            this.session.cursor.select(
                this.state.cursor.rowsRangeByX(event.offsetX).from,
                Owner.Chart,
                undefined,
                undefined,
            );
        } else {
            this.session.cursor.select(labels[0][2], Owner.Chart, undefined, undefined);
        }
    }

    @HostListener('wheel', ['$event']) wheel(event: WheelEvent): void {
        this.state.cursor.change(Math.round(event.deltaY / State.REDUCE_MOVE_ON_WHEEL)).resize();
        stop(event);
    }

    public x: string | undefined;
    public labels: TChartValues = [];
    public range: IRange | undefined;
    public cutted: number = 0;

    public override ngAfterViewInit(): void {
        super.ngAfterViewInit();
        this.renders = {
            charts: new ChartsRender(this.canvasElRef.nativeElement),
            filters: new FiltersRender(this.canvasElRef.nativeElement),
        };
        this.env().subscriber.register(
            this.session.charts.subjects.get().output.subscribe((event) => {
                this.renders.charts
                    .setValues(event.values)
                    .setPeaks(event.peaks)
                    .setCharts(event.charts)
                    .setFrame(event.frame)
                    .clear()
                    .refresh();
                this.renders.filters
                    .setMap(event.map)
                    .setFilters(event.filters)
                    .setFrame(event.frame)
                    .refresh();
            }),
        );
        this.session.charts.refresh();
    }

    public getLabelColor(color: string): string {
        return getContrastColor(color, true);
    }
}
export interface ViewChartOutput extends IlcInterface {}

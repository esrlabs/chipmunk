import { Component, AfterViewInit, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { OutputBase } from '../base/component';
import { Render as ChartsRender } from '../render/chart';
import { Render as FiltersRender } from '../render/filters';
import { State } from '../state';
import { stop } from '@ui/env/dom';
import { Label } from '../render/chart.label';
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
        const labels: Label[] = this.renders.charts.coors.get(event.offsetX);
        if (labels.length === 0) {
            this.session.cursor.select(
                this.state.cursor.rowsRangeByX(event.offsetX).from,
                Owner.Chart,
                undefined,
                undefined,
            );
        } else {
            this.session.cursor.select(labels[0].position, Owner.Chart, undefined, undefined);
        }
    }

    @HostListener('wheel', ['$event']) wheel(event: WheelEvent): void {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            this.state.cursor
                .change(Math.round(event.deltaY / State.REDUCE_ZOOM_ON_WHEEL))
                .resize();
        } else {
            this.state.cursor.change(Math.round(event.deltaX / State.REDUCE_MOVE_ON_WHEEL)).move();
        }
        stop(event);
    }

    public x: string | undefined;
    public labels: Label[] = [];
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
                this.renders.filters
                    .setMap(event.map)
                    .setFilters(event.filters)
                    .setActive(event.active)
                    .setFrame(event.frame)
                    .clear()
                    .refresh();
                this.renders.charts
                    .setSelected(event.selected)
                    .setValues(event.values)
                    .setPeaks(event.peaks)
                    .setCharts(event.charts)
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

import { Component, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { OutputBase } from '../base/component';
import { Render as ChartsRender } from '../render/chart';
import { Render as FiltersRender } from '../render/filters';

@Component({
    selector: 'app-views-chart-summary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewChartSummary extends OutputBase implements AfterViewInit {
    protected renders!: {
        charts: ChartsRender;
        filters: FiltersRender;
    };

    public override ngAfterViewInit(): void {
        super.ngAfterViewInit();
        this.renders = {
            charts: new ChartsRender(this.canvasElRef.nativeElement).ignorePoints(),
            filters: new FiltersRender(this.canvasElRef.nativeElement),
        };
        this.env().subscriber.register(
            this.session.charts.subjects.get().summary.subscribe((event) => {
                this.renders.filters
                    .setMap(event.map)
                    .setFilters(event.filters)
                    .setActive(event.active)
                    .setFrame(event.frame)
                    .clear()
                    .refresh();
                this.renders.charts
                    .setSelected(undefined)
                    .setValues(event.values)
                    .setPeaks(event.peaks)
                    .setCharts(event.charts)
                    .setFrame(event.frame)
                    .refresh();
            }),
        );
        this.session.charts.refresh();
    }
}
export interface ViewChartSummary extends IlcInterface {}

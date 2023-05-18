import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewChart } from './component';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ViewChartOutput } from './output/component';
import { ViewChartSummary } from './summary/component';
import { ViewChartCursor } from './cursor/component';

const components = [ViewChart, ViewChartOutput, ViewChartSummary, ViewChartCursor];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        AppDirectiviesModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class ChartModule {}

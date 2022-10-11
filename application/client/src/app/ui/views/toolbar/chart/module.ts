import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewChart } from './component';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { ViewChartCanvas } from './chart/component';
import { ViewChartZoomerCanvas } from './zoomer/component';
import { ViewChartZoomerCursorCanvas } from './zoomer/cursor/component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

const components = [ViewChart, ViewChartCanvas, ViewChartZoomerCanvas, ViewChartZoomerCursorCanvas];

@NgModule({
    entryComponents: [...components],
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

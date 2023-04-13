import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchModule } from './search/module';
import { HistoryModule } from './history/module';
import { DetailsModule } from './details/module';
import { ChartModule } from './chart/module';

@NgModule({
    imports: [CommonModule, SearchModule, HistoryModule, ChartModule, DetailsModule],
    declarations: [],
    exports: [SearchModule],
    bootstrap: [ChartModule]
})
export class ToolbarModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchModule } from './search/module';
import { HistoryModule } from './history/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, SearchModule, HistoryModule],
    declarations: [],
    exports: [SearchModule],
})
export class ToolbarModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchModule } from './search/module';
import { HistoryModule } from './history/module';
import { DetailsModule } from './details/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, SearchModule, HistoryModule, DetailsModule],
    declarations: [],
    exports: [SearchModule],
})
export class ToolbarModule {}

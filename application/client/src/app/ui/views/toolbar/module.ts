import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchModule } from './search/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, SearchModule],
    declarations: [],
    exports: [SearchModule],
})
export class ToolbarModule {}

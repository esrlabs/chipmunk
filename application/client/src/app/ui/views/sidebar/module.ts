import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, FiltersModule],
    declarations: [],
    exports: [FiltersModule],
})
export class SidebarModule {}

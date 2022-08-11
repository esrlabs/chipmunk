import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObserveListModule } from './observe/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, FiltersModule, ObserveListModule],
    declarations: [],
    exports: [FiltersModule],
})
export class SidebarModule {}

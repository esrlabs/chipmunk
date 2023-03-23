import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersModule } from './search/module';
import { ObservedModule } from './observe/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, FiltersModule, ObservedModule],
    declarations: [],
    exports: [FiltersModule],
})
export class SidebarModule {}

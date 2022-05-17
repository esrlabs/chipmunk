import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@ui/elements/containers/module';
import { RecentFile } from './file/component';
import { RecentActions } from './component';

@NgModule({
    entryComponents: [RecentFile, RecentActions],
    imports: [CommonModule, ContainersModule],
    declarations: [RecentFile, RecentActions],
    exports: [RecentFile, RecentActions],
})
export class RecentActionsModule {
    constructor() {}
}

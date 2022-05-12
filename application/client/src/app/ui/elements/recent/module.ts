import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RecentFile } from './file/component';

@NgModule({
    entryComponents: [RecentFile],
    imports: [CommonModule],
    declarations: [RecentFile],
    exports: [],
})
export class RecentActionsModule {
    constructor() {}
}

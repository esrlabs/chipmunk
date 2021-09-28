import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ElectronStateModule } from './electron.state/module';
import { QueueStateModule } from './queue.state/module';
import { StreamStateModule } from './stream.state/module';
import { SearchStateModule } from './search.state/module';
import { SelectionStateModule } from './selection.state/module';
import { EnvironmentComponentsModule } from '../../components/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, EnvironmentComponentsModule],
    declarations: [],
    exports: [
        ElectronStateModule,
        QueueStateModule,
        StreamStateModule,
        SearchStateModule,
        SelectionStateModule,
    ],
})
export class AppsBarStatusModule {
    constructor() {}
}

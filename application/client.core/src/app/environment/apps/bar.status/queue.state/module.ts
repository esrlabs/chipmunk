import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppsStatusBarQueueStateComponent } from './component';
import { EnvironmentComponentsModule } from '../../../components/module';

const components = [AppsStatusBarQueueStateComponent];

@NgModule({
    entryComponents: [...components],
    imports: [CommonModule, EnvironmentComponentsModule],
    declarations: [...components],
    exports: [...components],
})
export class QueueStateModule {
    constructor() {}
}

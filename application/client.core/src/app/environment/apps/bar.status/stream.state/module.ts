import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AppsStatusBarStreamStateComponent } from './component';
import { EnvironmentComponentsModule } from '../../../components/module';
import { TasksHistoryComponent } from './history/component';

const components = [AppsStatusBarStreamStateComponent, TasksHistoryComponent];

@NgModule({
    entryComponents: [...components],
    imports: [CommonModule, EnvironmentComponentsModule, MatProgressBarModule],
    declarations: [...components],
    exports: [...components],
})
export class StreamStateModule {
    constructor() {}
}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppsStatusBarElectronStateComponent } from './component';
import { StateHistoryComponent } from './history/component';
import { EnvironmentComponentsModule } from '../../../components/module';

const components = [AppsStatusBarElectronStateComponent, StateHistoryComponent];

@NgModule({
    entryComponents: [...components],
    imports: [CommonModule, EnvironmentComponentsModule],
    declarations: [...components],
    exports: [...components],
})
export class ElectronStateModule {
    constructor() {}
}

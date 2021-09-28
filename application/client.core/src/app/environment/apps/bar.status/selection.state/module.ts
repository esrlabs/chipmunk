import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppsStatusBarSelectionStateComponent } from './component';
import { EnvironmentComponentsModule } from '../../../components/module';

const components = [AppsStatusBarSelectionStateComponent];

@NgModule({
    entryComponents: [...components],
    imports: [CommonModule, EnvironmentComponentsModule],
    declarations: [...components],
    exports: [...components],
})
export class SelectionStateModule {
    constructor() {}
}

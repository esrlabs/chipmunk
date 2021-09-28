import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppsStatusBarSearchStateComponent } from './component';
import { EnvironmentComponentsModule } from '../../../components/module';

const components = [AppsStatusBarSearchStateComponent];

@NgModule({
    entryComponents: [...components],
    imports: [CommonModule, EnvironmentComponentsModule],
    declarations: [...components],
    exports: [...components],
})
export class SearchStateModule {
    constructor() {}
}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NotificationsModule } from './notifications/module';
import { PopupsModule } from './popups/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule],
    declarations: [],
    exports: [NotificationsModule, PopupsModule],
})
export class EnvironmentComplexModule {
    constructor() {}
}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ComColorSelectorComponent } from './color.selector/component';
import { ComTooltipComponent } from './tooltip/component';

@NgModule({
    entryComponents: [ComColorSelectorComponent, ComTooltipComponent],
    imports: [CommonModule],
    declarations: [ComColorSelectorComponent, ComTooltipComponent],
    exports: [ComColorSelectorComponent, ComTooltipComponent],
})
export class EnvironmentCommonModule {
    constructor() {}
}

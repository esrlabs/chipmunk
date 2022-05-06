import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContainersModule } from '@elements/containers/module';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { TabsModule } from '@elements/tabs/module';

import { ComColorSelectorComponent } from '@elements/color.selector/component';
import { ComTooltipComponent } from '@elements/tooltip/component';

@NgModule({
    entryComponents: [ComColorSelectorComponent, ComTooltipComponent],
    imports: [CommonModule, ContainersModule, ScrollAreaModule, TabsModule],
    declarations: [ComColorSelectorComponent, ComTooltipComponent],
    exports: [ContainersModule, ScrollAreaModule, TabsModule],
})
export class ElementsModule {
    constructor() {}
}

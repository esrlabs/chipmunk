import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScrollAreaComponent } from './component';
import { ScrollAreaVerticalComponent } from './vertical/component';
import { RowModule } from './row/module';

export { ScrollAreaComponent };

const entryComponents = [ScrollAreaComponent, ScrollAreaVerticalComponent];
const components = [...entryComponents];

@NgModule({
    imports: [CommonModule, RowModule],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components, RowModule]
})
export class ScrollAreaModule {}

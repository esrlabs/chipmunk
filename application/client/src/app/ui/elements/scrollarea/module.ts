import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ScrollAreaComponent } from './component';
import { ScrollAreaVerticalComponent } from './vertical/component';
import { RowModule } from './row/module';

export { ScrollAreaComponent };

@NgModule({
    imports: [CommonModule, RowModule],
    declarations: [ScrollAreaComponent, ScrollAreaVerticalComponent],
    exports: [ScrollAreaComponent, RowModule],
    bootstrap: [ScrollAreaComponent, RowModule],
})
export class ScrollAreaModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HiddenFilter } from './component';
export { HiddenFilter } from './component';

@NgModule({
    imports: [CommonModule],
    declarations: [HiddenFilter],
    exports: [HiddenFilter],
})
export class HiddenFilterModule {}

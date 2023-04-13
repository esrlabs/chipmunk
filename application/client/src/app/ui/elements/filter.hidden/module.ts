import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HiddenFilter } from './component';
export { HiddenFilter } from './component';

const components = [HiddenFilter];
@NgModule({
    imports: [CommonModule],
    declarations: [...components],
    exports: [...components]
})
export class HiddenFilterModule {}

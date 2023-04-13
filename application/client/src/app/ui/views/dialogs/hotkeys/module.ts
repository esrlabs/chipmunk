import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Hotkeys } from './component';

@NgModule({
    imports: [CommonModule],
    declarations: [Hotkeys],
    exports: [Hotkeys],
    bootstrap: [Hotkeys]
})
export class HotkeysModule {}

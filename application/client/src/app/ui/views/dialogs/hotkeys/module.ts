import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Hotkeys } from './component';

@NgModule({
    entryComponents: [Hotkeys],
    imports: [CommonModule],
    declarations: [Hotkeys],
    exports: [Hotkeys],
})
export class HotkeysModule {}

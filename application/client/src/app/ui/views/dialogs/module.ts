import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HotkeysModule } from './hotkeys/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, HotkeysModule],
    declarations: [],
    exports: [HotkeysModule],
})
export class DialogsModule {}

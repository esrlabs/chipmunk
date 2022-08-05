import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HotkeysModule } from './hotkeys/module';
import { ProgressMessageModule } from './progress/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, HotkeysModule, ProgressMessageModule],
    declarations: [],
    exports: [HotkeysModule, ProgressMessageModule],
})
export class DialogsModule {}

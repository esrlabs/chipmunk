import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HotkeysModule } from './hotkeys/module';
import { LockerMessageModule } from './locker/module';

@NgModule({
    entryComponents: [],
    imports: [CommonModule, HotkeysModule, LockerMessageModule],
    declarations: [],
    exports: [HotkeysModule, LockerMessageModule],
})
export class DialogsModule {}

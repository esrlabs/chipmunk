import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HotkeysModule } from './hotkeys/module';
import { LockerMessageModule } from './locker/module';
import { AboutModule } from './about/module';

@NgModule({
    imports: [CommonModule, HotkeysModule, AboutModule, LockerMessageModule],
    declarations: [],
    exports: [HotkeysModule, AboutModule, LockerMessageModule],
    bootstrap: [HotkeysModule, AboutModule, LockerMessageModule]
})
export class DialogsModule {}

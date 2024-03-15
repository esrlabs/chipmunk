import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HotkeysModule } from './hotkeys/module';
import { LockerMessageModule } from './locker/module';
import { AboutModule } from './about/module';
import { ColorSelectorModule } from './colors/module';
import { CommentModule } from './comment/module';

@NgModule({
    imports: [
        CommonModule,
        HotkeysModule,
        AboutModule,
        LockerMessageModule,
        ColorSelectorModule,
        CommentModule,
    ],
    declarations: [],
    exports: [HotkeysModule, AboutModule, LockerMessageModule, CommentModule],
    bootstrap: [HotkeysModule, AboutModule, LockerMessageModule, CommentModule],
})
export class DialogsModule {}

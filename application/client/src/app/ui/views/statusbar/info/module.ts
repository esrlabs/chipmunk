import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SessionInfo } from './component';

@NgModule({
    imports: [CommonModule],
    declarations: [SessionInfo],
    exports: [SessionInfo],
})
export class SessionInfoModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Session } from './component';

@NgModule({
    imports: [CommonModule, MatProgressSpinnerModule],
    declarations: [Session],
    exports: [Session]
})
export class SessionModule {}

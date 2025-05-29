import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { TimezoneSelector } from './component';

@NgModule({
    imports: [CommonModule, MatButtonModule, MatIcon],
    declarations: [TimezoneSelector],
    exports: [TimezoneSelector],
    bootstrap: [TimezoneSelector],
})
export class TimezoneSelectorModule {}

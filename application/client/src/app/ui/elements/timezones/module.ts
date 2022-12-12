import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElementsTimezoneSelector } from './component';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';

@NgModule({
    entryComponents: [ElementsTimezoneSelector],
    imports: [CommonModule, MatSelectModule, MatListModule],
    declarations: [ElementsTimezoneSelector],
    exports: [ElementsTimezoneSelector],
    bootstrap: [ElementsTimezoneSelector],
})
export class TimezoneSelectorModule {}

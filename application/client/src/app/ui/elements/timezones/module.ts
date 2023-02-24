import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElementsTimezoneSelector } from './component';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { HiddenFilterModule } from '@elements/filter.hidden/module';

@NgModule({
    entryComponents: [ElementsTimezoneSelector],
    imports: [CommonModule, MatSelectModule, MatListModule, HiddenFilterModule],
    declarations: [ElementsTimezoneSelector],
    exports: [ElementsTimezoneSelector],
    bootstrap: [ElementsTimezoneSelector],
})
export class TimezoneSelectorModule {}

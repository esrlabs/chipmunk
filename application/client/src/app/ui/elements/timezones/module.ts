import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElementsTimezoneSelector } from './component';
import { HiddenFilterModule } from '@elements/filter.hidden/module';

@NgModule({
    imports: [CommonModule, HiddenFilterModule],
    declarations: [ElementsTimezoneSelector],
    exports: [ElementsTimezoneSelector],
    bootstrap: [ElementsTimezoneSelector]
})
export class TimezoneSelectorModule {}

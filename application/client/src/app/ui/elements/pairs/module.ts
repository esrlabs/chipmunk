import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElementsPairs } from './component';
import { MatTableModule } from '@angular/material/table';
import { HiddenFilterModule } from '@elements/filter.hidden/module';

@NgModule({
    imports: [CommonModule, MatTableModule, HiddenFilterModule],
    declarations: [ElementsPairs],
    exports: [ElementsPairs],
    bootstrap: [ElementsPairs]
})
export class PairsModule {}

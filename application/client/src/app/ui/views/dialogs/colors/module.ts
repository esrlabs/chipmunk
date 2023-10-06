import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColorSelector } from './component';
import { MatButtonModule } from '@angular/material/button';
import { ColorSelectorModule as Selector } from '@elements/color.selector/module';

@NgModule({
    imports: [CommonModule, MatButtonModule, Selector],
    declarations: [ColorSelector],
    exports: [ColorSelector],
    bootstrap: [ColorSelector],
})
export class ColorSelectorModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComColorSelectorComponent } from './component';

@NgModule({
    imports: [CommonModule],
    declarations: [ComColorSelectorComponent],
    exports: [ComColorSelectorComponent],
})
export class ColorSelectorModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Details } from './component';

@NgModule({
    imports: [CommonModule],
    declarations: [Details],
    exports: [Details],
    bootstrap: [Details],
})
export class DetailsModule {}

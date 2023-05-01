import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Details } from './component';

const entryComponents = [Details];
const components = [...entryComponents];

@NgModule({
    imports: [CommonModule],
    declarations: [...components],
    exports: [...components],
})
export class DetailsModule {}

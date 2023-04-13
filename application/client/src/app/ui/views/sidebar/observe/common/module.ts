import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from './title/component';

const entryComponents = [Title];
const components = [...entryComponents];

@NgModule({
    imports: [CommonModule],
    declarations: [...components],
    exports: [...components]
})
export class CommonObserveModule {}

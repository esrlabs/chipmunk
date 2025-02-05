import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from './title/component';

@NgModule({
    imports: [CommonModule],
    declarations: [Title],
    exports: [Title],
})
export class CommonObserveModule {}

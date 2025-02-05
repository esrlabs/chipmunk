import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { List } from './component';
import { ElementModule } from '../../element/module';
import { CommonObserveModule } from '../../common/module';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
    imports: [CommonModule, ElementModule, CommonObserveModule, MatButtonModule],
    declarations: [List],
    exports: [List],
})
export class ListModule {}

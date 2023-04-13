import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { List } from './component';
import { ElementModule } from '../../element/module';
import { CommonObserveModule } from '../../common/module';
import { MatButtonModule } from '@angular/material/button';

const entryComponents = [List];
const components = [...entryComponents];

@NgModule({
    imports: [CommonModule, ElementModule, CommonObserveModule, MatButtonModule],
    declarations: [...components],
    exports: [...components]
})
export class ListModule {}

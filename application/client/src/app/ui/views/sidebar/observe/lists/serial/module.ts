import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { List } from './component';
import { ElementModule } from '../../element/module';
import { CommonObserveModule } from '../../common/module';

const entryComponents = [List];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [CommonModule, ElementModule, CommonObserveModule],
    declarations: [...components],
    exports: [...components],
})
export class ListModule {}

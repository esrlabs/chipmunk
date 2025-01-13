import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { List } from './component';
import { ElementModule } from '../../element/module';
import { CommonObserveModule } from '../../common/module';
import { QuickSetupModule } from '@ui/tabs/observe/origin/stream/transport/setup/quick/process/module';

@NgModule({
    imports: [CommonModule, ElementModule, CommonObserveModule, QuickSetupModule],
    declarations: [List],
    exports: [List],
})
export class ListModule {}

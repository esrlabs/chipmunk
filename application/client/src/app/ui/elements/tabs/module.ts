import { ContainersModule } from '../containers/module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { TabsComponent } from './component';
import { TabsListComponent } from './list/component';
import { TabContentComponent } from './content/component';

export { TabsComponent, TabsListComponent, TabContentComponent };

@NgModule({
    imports: [CommonModule, ContainersModule, MatIconModule],
    declarations: [TabsListComponent, TabContentComponent, TabsComponent],
    exports: [TabsComponent],
})
export class TabsModule {}

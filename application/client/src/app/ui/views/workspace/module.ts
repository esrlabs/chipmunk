import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewWorkspace } from './component';
import { ViewContentMapComponent } from './map/component';
import { ColumnsHeaders } from './headers/component';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';

const entryComponents = [ViewWorkspace, ViewContentMapComponent, ColumnsHeaders];
const components = [ViewWorkspace, ...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [CommonModule, ContainersModule, ScrollAreaModule, AppDirectiviesModule],
    declarations: [...components],
    exports: [...components, ScrollAreaModule],
})
export class WorkspaceModule {}

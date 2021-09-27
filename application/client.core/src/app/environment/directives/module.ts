import { NgModule } from '@angular/core';
import { MatDragDropResetFeatureDirective } from './material.dragdrop.directive';
import { FocusDefaultButtonDirective } from './focus.button.directive';
import { ToolTipDirective } from './tooltip.directive';
import { PortalModule } from '@angular/cdk/portal';
import { OverlayModule } from '@angular/cdk/overlay';

const modules = [PortalModule, OverlayModule];

@NgModule({
    declarations: [MatDragDropResetFeatureDirective, FocusDefaultButtonDirective, ToolTipDirective],
    exports: [MatDragDropResetFeatureDirective, FocusDefaultButtonDirective, ToolTipDirective],
    imports: [...modules],
})
export class AppDirectiviesModule {
    constructor() {}
}

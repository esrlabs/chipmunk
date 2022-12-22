import { Component, Input } from '@angular/core';
// import { DialogsRecentFilesActionComponent } from '@dialogs/recentfile/component';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-layout-workspace-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutWorkspaceControls {
    @Input() public onNewTab!: () => void;

    public addNewTab(event: MouseEvent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof this.onNewTab !== 'function') {
            return false;
        }
        this.onNewTab();
        return false;
    }
}
export interface LayoutWorkspaceControls extends IlcInterface {}

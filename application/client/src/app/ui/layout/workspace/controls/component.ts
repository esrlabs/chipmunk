import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { stop } from '@ui/env/dom';

@Component({
    selector: 'app-layout-workspace-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutWorkspaceControls {
    @Input() public onNewTab!: () => void;

    public addNewTab(event: MouseEvent) {
        stop(event);
        if (typeof this.onNewTab !== 'function') {
            return false;
        }
        this.onNewTab();
        return false;
    }
}
export interface LayoutWorkspaceControls extends IlcInterface {}

import { Component, Input } from '@angular/core';
// import { DialogsRecentFilesActionComponent } from '@dialogs/recentfile/component';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';

@Component({
    selector: 'app-layout-workspace-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutWorkspaceControls {
    @Input() public onNewTab!: () => void;

    constructor() {
        this.ilc().channel.ux.hotkey((event: Declarations.HotkeyEvent) => {
            if (event.key !== Declarations.Hotkey.recentFiles) {
                return;
            }
            this.openRecentFilesDialog();
        });
    }

    public addNewTab(event: MouseEvent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof this.onNewTab !== 'function') {
            return false;
        }
        this.onNewTab();
        return false;
    }

    public openRecentFilesDialog() {
        // const closer = this.ilc().services.ui.popup.open({
        //     caption: ``,
        //     component: {
        //         factory: DialogsRecentFilesActionComponent,
        //         inputs: {
        //             close: () => {
        //                 closer.emit();
        //             },
        //         },
        //     },
        //     buttons: [],
        //     options: {
        //         width: 40,
        //         minimalistic: true,
        //     },
        // });
    }
}
export interface LayoutWorkspaceControls extends IlcInterface {}

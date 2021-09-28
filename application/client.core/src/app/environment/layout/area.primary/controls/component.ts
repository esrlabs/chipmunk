import { Component, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DialogsRecentFilesActionComponent } from '../../../components/dialogs/recentfile/component';
import PopupsService from '../../../services/standalone/service.popups';
import HotkeysService from '../../../services/service.hotkeys';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-layout-area-primary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutPrimiryAreaControlsComponent implements OnDestroy {
    @Input() public onNewTab!: () => void;
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.recentFiles = HotkeysService.getObservable().recentFiles.subscribe(
            this._ng_onRecent.bind(this),
        );
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((prop: string) => {
            this._subscriptions[prop].unsubscribe();
        });
    }

    public _ng_onAddNew(event: MouseEvent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof this.onNewTab !== 'function') {
            return false;
        }
        this.onNewTab();
        return false;
    }

    public _ng_onRecent() {
        const popupId: string | undefined = PopupsService.add({
            id: 'recent-files-dialog',
            caption: ``,
            component: {
                factory: DialogsRecentFilesActionComponent,
                inputs: {
                    close: () => {
                        popupId !== undefined && PopupsService.remove(popupId);
                    },
                },
            },
            buttons: [],
            options: {
                width: 40,
                minimalistic: true,
            },
        });
    }
}

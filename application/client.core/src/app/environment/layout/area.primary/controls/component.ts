import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DialogsRecentFilesActionComponent } from '../../../components/dialogs/recentfile/component';
import PopupsService from '../../../services/standalone/service.popups';

@Component({
    selector: 'app-layout-area-primary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimiryAreaControlsComponent implements AfterViewInit, OnDestroy {

    @Input() public onNewTab: () => void;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {

    }

    ngOnDestroy() {

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

    public _ng_onRecent(event: MouseEvent) {
        const popupId: string = PopupsService.add({
            caption: `Open Recent Files`,
            component: {
                factory: DialogsRecentFilesActionComponent,
                inputs: {
                    close: () => {
                        PopupsService.remove(popupId);
                    }
                }
            },
            buttons: [
                {
                    caption: 'Cancel',
                    handler: () => {
                        PopupsService.remove(popupId);
                    }
                },
            ],
            options: {
                width: 40
            }
        });
    }

}

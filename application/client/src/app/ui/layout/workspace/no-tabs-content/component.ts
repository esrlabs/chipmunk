import {
    Component,
    ViewEncapsulation,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Storage as ActionsStorage } from '../../../../service/actions/storage';
import { Base as Action } from '../../../../service/actions/action';
import { ChangesDetector } from '@ui/env/extentions/changes';

import * as actions from '@service/actions/index';

@Component({
    selector: 'app-layout-area-no-tabs-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class LayoutHome extends ChangesDetector implements AfterViewInit, OnDestroy {
    public readonly menu = {
        file: [
            new actions.FileAny.Action(),
            new actions.FileDlt.Action(),
            new actions.FilePcap.Action(),
            new actions.FilePcapLegacy.Action(),
            null,
            new actions.FolderText.Action(),
            new actions.FolderDlt.Action(),
            new actions.FolderPcap.Action(),
            new actions.FilePcapLegacy.Action(),
        ],
        conenctTo: [
            new actions.UdpDlt.Action(),
            new actions.TcpDlt.Action(),
            null,
            new actions.SerialText.Action(),
        ],
        terminal: new actions.StdoutText.Action(),
    };
    public actions: ActionsStorage = new ActionsStorage();
    public pinned: Array<Action | null> = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.actions.destroy();
    }

    public ngAfterViewInit(): void {
        this.actions.load();
        this.env().subscriber.register(
            this.actions.updated.subscribe(() => {
                this.update();
            }),
        );
        this.update();
    }

    protected update() {
        const actions = this.actions.get().sort((a, b) => (a.group() > b.group() ? -1 : 1));
        const pinned: Array<Action | null> = [];
        let group = -1;
        actions.forEach((action) => {
            if (group === -1) {
                group = action.group();
            }
            if (group !== action.group()) {
                pinned.push(null);
                group = action.group();
            }
            pinned.push(action);
        });
        this.pinned = pinned;
        this.detectChanges();
    }
}
export interface LayoutHome extends IlcInterface {}

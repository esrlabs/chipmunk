import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import SidebarSessionsService from '../../../services/service.sessions.sidebar';
import LayoutStateService from '../../../services/standalone/service.layout.state';
// import { CGuids } from '../../../states/state.default.sidebar.apps';

@Component({
    selector: 'app-views-dialogs-comment-add-on-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsAddCommentOnRowComponent implements AfterContentInit {

    public _ng_comment: string = '';

    @Input() add: (comment: string) => void = (comment: string) => {};
    @Input() cancel: () => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterContentInit() {

    }

    public _ng_onAdd() {
        if (this._ng_comment.trim().length === 0) {
            return;
        }
        if (!SidebarSessionsService.has(`comments`)) {
            SidebarSessionsService.addByGuid(`comments`);
        } else {
            SidebarSessionsService.setActive(`comments`);
        }
        LayoutStateService.sidebarMax();
        this.add(this._ng_comment);
    }

    public _ng_onCancel() {
        this.cancel();
    }

}

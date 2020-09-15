import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';

interface IKey {
    shortkeys: string[];
    description: string;
}

interface IGroup {
    name: string;
    keys: IKey[];
}

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
        this.add(this._ng_comment);
    }

    public _ng_onCancel() {
        this.cancel();
    }

}

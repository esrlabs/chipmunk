import { Component, ChangeDetectorRef, Input, AfterViewInit, ViewChild } from '@angular/core';
import { MatInput } from '@angular/material/input';

@Component({
    selector: 'app-views-dialogs-comment-add-on-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsAddCommentOnRowComponent implements AfterViewInit {

    public _ng_comment: string = '';

    @ViewChild(MatInput, { static: true }) _ng_inputComRef: MatInput;

    @Input() add: (comment: string) => void = (comment: string) => {};
    @Input() cancel: () => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        setTimeout(() => { this._ng_inputComRef.focus(); }, 150);
    }

    public _ng_onKeyDown(event: KeyboardEvent) {
        console.log(event);
        if (event.code === 'Enter') {
            this._ng_onAdd();
        }
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

import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterViewInit,
    AfterContentInit,
    ViewChild,
} from '@angular/core';
import { MatInput } from '@angular/material/input';
import { IComment } from '../../../controller/session/dependencies/comments/session.dependency.comments.types';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

export class InputErrorStateMatcher implements ErrorStateMatcher {
    private _valid: boolean = true;
    private _error: string = '';

    constructor() {}

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        this._valid = true;
        this._error = '';
        if (control !== null && (control.value === null || control.value.trim() === '')) {
            this._valid = false;
            this._error = `Value of comment cannot be empty`;
        }
        if (control !== null && control.value !== null && control.value.length > 1024) {
            this._valid = false;
            this._error = `Maximum length of comment is 1024 chars`;
        }
        return this._valid;
    }

    public isValid(): boolean {
        return this._valid;
    }

    public getError(): string | undefined {
        return this._error;
    }
}

@Component({
    selector: 'app-views-dialogs-comment-add-on-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsAddCommentOnRowComponent implements AfterViewInit, AfterContentInit {
    public _ng_comment: string = '';
    public _ng_input_error: InputErrorStateMatcher = new InputErrorStateMatcher();

    @ViewChild(MatInput, { static: true }) _ng_inputComRef!: MatInput;

    @Input() comment!: IComment;

    public _ng_mode: 'edit' | 'create' = 'edit';

    @Input() accept: (comment: string) => void = (comment: string) => {};
    @Input() remove: () => void = () => {};
    @Input() cancel: () => void = () => {};

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterContentInit() {
        this._ng_comment = this.comment.comment;
        this._ng_mode = this.comment.comment === '' ? 'create' : 'edit';
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this._ng_inputComRef.focus();
        }, 150);
    }

    public _ng_onKeyDown(event: KeyboardEvent) {
        if (event.code === 'Enter') {
            this._ng_onAccept();
        }
    }

    public _ng_onAccept() {
        if (!this._ng_input_error.isValid()) {
            return;
        }
        this.accept(this._ng_comment);
    }

    public _ng_onRemove() {
        this.remove();
    }

    public _ng_onCancel() {
        this.cancel();
    }
}

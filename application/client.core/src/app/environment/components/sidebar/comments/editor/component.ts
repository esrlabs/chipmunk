import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ICommentResponse } from '../../../../controller/session/dependencies/comments/session.dependency.comments.types';

export class InputErrorStateMatcher implements ErrorStateMatcher {
    private _valid: boolean = true;
    private _error: string = '';

    constructor() {}

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        this._valid = true;
        this._error = '';
        if (control.value === null || control.value.trim() === '') {
            this._valid = false;
            this._error = `Value of comment cannot be empty`;
        }
        if (control.value !== null && control.value.length > 1024) {
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
    selector: 'app-sidebar-app-comments-editor',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppCommentsEditorComponent implements OnDestroy, AfterContentInit {
    @Input() response!: ICommentResponse;
    @Input() save!: (comment: string) => void;
    @Input() remove!: () => void;
    @Input() cancel!: () => void;

    public _ng_input_error: InputErrorStateMatcher = new InputErrorStateMatcher();
    public _ng_response: string = '';
    public _ng_mode: 'create' | 'edit' = 'create';

    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterContentInit() {
        if (this.response.guid !== '') {
            this._ng_response = this.response.comment;
            this._ng_mode = 'edit';
        }
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    public _ng_onKeyDown(event: KeyboardEvent) {
        if (event.code === 'Enter') {
            this._ng_onAccept();
        }
    }

    public _ng_onAccept() {
        this.save(this._ng_response);
    }

    public _ng_onRemove() {
        this.remove();
    }

    public _ng_onCancel() {
        this.cancel();
    }
}

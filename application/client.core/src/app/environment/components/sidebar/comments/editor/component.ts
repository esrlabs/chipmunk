import { Component, OnDestroy, ChangeDetectorRef, Input, OnChanges, AfterContentInit, AfterViewInit } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ICommentResponse } from '../../../../controller/controller.session.tab.stream.comments.types';

import * as Toolkit from 'chipmunk.client.toolkit';

export class InputErrorStateMatcher implements ErrorStateMatcher {
    private _valid: boolean = true;
    private _error: string = '';

    constructor() {
    }

    public isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
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

export class SidebarAppCommentsEditorComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() comment: ICommentResponse;
    @Input() save: (comment: string) => void;
    @Input() cancel: () => void;
    @Input() mode: 'create' | 'edit' = 'create';

    public _ng_input_error: InputErrorStateMatcher = new InputErrorStateMatcher();
    public _ng_comment: string = '';

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

public _ng_onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Enter') {
        this._ng_onAccept();
    }
}


    public _ng_onAccept() {
        this.save(this._ng_comment);
    }

    public _ng_onCancel() {
        this.cancel();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}

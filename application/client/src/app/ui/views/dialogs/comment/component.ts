import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterViewInit,
    AfterContentInit,
    ViewChild,
} from '@angular/core';
import { MatInput } from '@angular/material/input';
import { CommentDefinition } from '@platform/types/comment';
import { FormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';

export class InputErrorStateMatcher implements ErrorStateMatcher {
    private _valid: boolean = true;
    private _error: string = '';

    constructor() {}

    public isErrorState(control: FormControl | null): boolean {
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
        return !this._valid;
    }

    public isValid(): boolean {
        return this._valid;
    }

    public getError(): string | undefined {
        return this._error;
    }
}

@Component({
    selector: 'app-dialogs-comment',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Comment extends ChangesDetector implements AfterViewInit, AfterContentInit {
    public ng_comment: string = '';
    public ng_input_error: InputErrorStateMatcher = new InputErrorStateMatcher();

    @ViewChild(MatInput, { static: true }) ng_inputComRef!: MatInput;

    @Input() comment!: CommentDefinition;

    public ng_mode: 'edit' | 'create' = 'edit';

    @Input() accept: (comment: string) => void = (_comment: string) => {};
    @Input() remove: () => void = () => {};
    @Input() cancel: () => void = () => {};

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterContentInit() {
        this.ng_comment = this.comment.comment;
        this.ng_mode = this.comment.comment === '' ? 'create' : 'edit';
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.ng_inputComRef.focus();
        }, 150);
    }

    public ng_onKeyDown(event: KeyboardEvent) {
        if (event.code === 'Enter') {
            this.ng_onAccept();
        }
    }

    public ng_onAccept() {
        if (!this.ng_input_error.isValid()) {
            return;
        }
        this.accept(this.ng_comment);
    }

    public ng_onRemove() {
        this.remove();
    }

    public ng_onCancel() {
        this.cancel();
    }
}
export interface Comment extends IlcInterface {}

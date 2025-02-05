import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl } from '@angular/forms';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Response } from '@platform/types/comment';

export class InputErrorStateMatcher implements ErrorStateMatcher {
    protected valid: boolean = true;
    protected error: string = '';

    constructor() {}

    public isErrorState(control: FormControl | null): boolean {
        if (control === null) {
            return false;
        }
        this.valid = true;
        this.error = '';
        if (control.value === null || control.value.trim() === '') {
            this.valid = false;
            this.error = `Value of comment cannot be empty`;
        }
        if (control.value !== null && control.value.length > 1024) {
            this.valid = false;
            this.error = `Maximum length of comment is 1024 chars`;
        }
        return !this.valid;
    }

    public getError(): string | undefined {
        return this.error;
    }
}

@Component({
    selector: 'app-views-comments-editor',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Editor extends ChangesDetector implements AfterContentInit {
    @Input() response!: Response;
    @Input() save!: (comment: string) => void;
    @Input() remove!: () => void;
    @Input() cancel!: () => void;

    public ng_input_error: InputErrorStateMatcher = new InputErrorStateMatcher();
    public ng_response: string = '';
    public ng_mode: 'create' | 'edit' = 'create';

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        if (this.response.uuid !== '') {
            this.ng_response = this.response.comment;
            this.ng_mode = 'edit';
        }
    }

    public onKeyDown(event: KeyboardEvent) {
        if (event.code === 'Enter') {
            this.onAccept();
        }
    }

    public onAccept() {
        this.save(this.ng_response);
    }

    public onRemove() {
        this.remove();
    }

    public onCancel() {
        this.cancel();
    }
}
export interface Editor extends IlcInterface {}

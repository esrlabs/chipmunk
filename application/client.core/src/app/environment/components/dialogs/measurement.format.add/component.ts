import {
    Component,
    Input,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
    ViewContainerRef,
    AfterContentInit,
} from '@angular/core';
import {
    IFormat,
    ControllerSessionTabTimestamp,
} from '../../../controller/session/dependencies/timestamps/session.dependency.timestamps';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

import OutputParsersService from '../../../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

class TimestampRowMatchParser extends Toolkit.RowCommonParser {
    static id: string = 'runtime-timestamp-matcher';

    private _regexp: RegExp;

    constructor(regexp: RegExp) {
        super();
        this._regexp = regexp;
    }
    public parse(str: string, themeTypeRef: Toolkit.EThemeType, row: Toolkit.IRowInfo): string {
        return str.replace(this._regexp, (_match: string) => {
            return `<span class="accent">${_match}</span>`;
        });
    }
}

export class ForamtErrorStateMatcher implements ErrorStateMatcher {
    private _controller: ControllerSessionTabTimestamp;
    private _update: () => void;
    private _valid: boolean = true;
    private _error: string | undefined;
    private _last_checked: string = '';

    constructor(controller: ControllerSessionTabTimestamp, update: () => void) {
        this._controller = controller;
        this._update = update;
    }

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        const valid = this._valid;
        if (this._last_checked !== control.value) {
            this._last_checked = control.value;
            this._controller
                .validate(control.value)
                .then((regexp: RegExp) => {
                    this._valid = true;
                    this._error = undefined;
                    OutputParsersService.setSessionParser(
                        TimestampRowMatchParser.id,
                        new TimestampRowMatchParser(regexp),
                        undefined,
                        true,
                    );
                })
                .catch((error: Error) => {
                    this._valid = false;
                    this._error = error.message;
                    OutputParsersService.removeSessionParser(
                        TimestampRowMatchParser.id,
                        undefined,
                        true,
                    );
                })
                .finally(() => {
                    if (valid !== this._valid) {
                        this._update();
                    }
                });
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
    selector: 'app-views-dialogs-measurement-add-format',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsMeasurementAddFormatComponent
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @Input() controller!: ControllerSessionTabTimestamp;
    @Input() add!: () => void;
    @Input() cancel!: () => void;

    public _ng_format_error!: ForamtErrorStateMatcher;
    public _ng_format: string = '';
    public _ng_disabled: boolean = true;

    private _logger: Toolkit.Logger = new Toolkit.Logger('DialogsMeasurementAddFormatComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {}

    ngAfterContentInit() {
        this._ng_format_error = new ForamtErrorStateMatcher(
            this.controller,
            this._forceUpdate.bind(this),
        );
    }

    ngAfterViewInit() {}

    ngOnDestroy() {
        OutputParsersService.removeSessionParser(TimestampRowMatchParser.id, undefined, true);
    }

    public _ng_onFormatChange() {
        if (this.controller === undefined) {
            return;
        }
    }

    public _ng_add() {
        this.controller
            .validate(this._ng_format)
            .then((regexp: RegExp) => {
                this.controller.addFormat({
                    format: this._ng_format,
                    regexp: regexp,
                });
                this.add();
            })
            .catch((error: Error) => {
                this._logger.warn(`Fail get regexp from datetime format: `);
            });
    }

    public _ng_cancel() {
        this.cancel();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._ng_disabled = !this._ng_format_error.isValid();
        this._cdRef.detectChanges();
    }
}

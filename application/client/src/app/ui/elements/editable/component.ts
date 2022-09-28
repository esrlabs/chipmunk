import {
    HostListener,
    Component,
    Input,
    Output,
    ChangeDetectorRef,
    ViewChild,
    EventEmitter,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatInput } from '@angular/material/input';

import * as dom from '@ui/env/dom';

@Component({
    selector: 'app-editable-field',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class Field extends ChangesDetector {
    @Input() public placeholder!: string;
    @Input() public value!: string;
    @Input() public caption!: string;
    @Output() public changed: EventEmitter<string> = new EventEmitter();
    @Output() public canceled: EventEmitter<void> = new EventEmitter();
    @Output() public edit: EventEmitter<void> = new EventEmitter();

    @ViewChild(MatInput) _inputRefCom!: MatInput;

    @HostListener('click', ['$event']) onClick(event: MouseEvent) {
        this.editable = true;
        this.prev = this.value;
        this.detectChanges();
        if (this._inputRefCom !== undefined) {
            this._inputRefCom.focus();
        }
        this.edit.emit();
        return dom.stop(event);
    }

    public editable: boolean = false;
    protected prev: string = '';

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public onKeyUp(event: KeyboardEvent) {
        if (['Escape', 'Enter'].indexOf(event.code) === -1) {
            return;
        }
        this.editable = false;
        this.detectChanges();
        switch (event.code) {
            case 'Escape':
                this.value = this.prev;
                this.canceled.emit();
                break;
            case 'Enter':
                this.changed.emit(this.value);
                break;
        }
    }

    public onBlur() {
        this.editable = false;
        this.detectChanges();
    }
}
export interface Field extends IlcInterface {}

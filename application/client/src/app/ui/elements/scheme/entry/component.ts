import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterViewInit,
    AfterContentInit,
    HostBinding,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { SchemeProvider, ForcedValueChanges } from '../provider';
import { FieldDesc, LazyFieldDesc, StaticFieldDesc, ValueInput } from '@platform/types/bindings';
import { ChangeEvent, Element } from './inner/element';
import { WrappedField } from '../field';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SchemeEntryElement } from './inner/component';

@Component({
    selector: 'app-settings-scheme-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCheckboxModule,
        MatCardModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatProgressBarModule,
        SchemeEntryElement,
    ],
    standalone: true,
})
@Initial()
@Ilc()
export class SchemeEntry extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() provider!: SchemeProvider;
    @Input() field!: FieldDesc;

    @HostBinding('class') classes = 'field';

    public pending: LazyFieldDesc | undefined;
    public loaded: StaticFieldDesc | undefined;
    public element: Element | undefined;
    public name!: string;
    public desc!: string;
    public error: string | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.pending = (this.field as { Lazy: LazyFieldDesc }).Lazy;
        this.loaded = (this.field as { Static: StaticFieldDesc }).Static;
        const wrapped = new WrappedField(this.field);
        this.name = wrapped.name;
        this.desc = wrapped.desc;
        this.init();
        this.env().subscriber.register(
            this.provider.subjects.get().loaded.subscribe((loaded: StaticFieldDesc) => {
                if (!this.pending || this.pending.id !== loaded.id) {
                    return;
                }
                this.loaded = loaded;
                this.pending = undefined;
                this.init();
                this.detectChanges();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.detectChanges();
    }

    init() {
        if (this.loaded) {
            this.element = new Element(this.loaded.id, this.loaded.interface);
            this.env().subscriber.register(
                this.element.subjects.get().changed.subscribe(this.onSelfChanges.bind(this)),
            );
            this.env().subscriber.register(
                this.provider.subjects.get().forced.subscribe(this.onFieldsChanges.bind(this)),
            );
            this.env().subscriber.register(
                this.provider.subjects.get().error.subscribe(this.onError.bind(this)),
            );
            const value = this.element.getValue();
            value && this.provider.setValue(this.loaded.id, value);
            this.element.loaded();
            this.classes = this.element.isField() ? 'field' : 'panel';
            return;
        }
    }

    protected onError(errs: Map<string, string>) {
        const prev = this.error;
        if (!this.element || !this.loaded) {
            this.error = undefined;
            return;
        }
        this.error = errs.get(this.loaded.id);
        if (prev !== this.error) {
            this.detectChanges();
        }
    }

    protected onSelfChanges(event: ChangeEvent) {
        if (!this.element || !this.loaded) {
            return;
        }
        const value = this.element.getValue();
        if (value) {
            if (this.loaded.binding) {
                this.provider.force(this.loaded.binding, event.inner);
            }
            this.provider.setValue(new WrappedField(this.field).id, value);
        }
    }

    protected onFieldsChanges(event: ForcedValueChanges) {
        if (!this.loaded || !this.element) {
            return;
        }
        if (event.target !== this.loaded.id) {
            return;
        }
        this.element.setValue(event.value);
        const value = this.element.getValue();
        if (value) {
            this.provider.setValue(this.loaded.id, value);
        }
    }
}
export interface SchemeEntry extends IlcInterface {}

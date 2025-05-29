import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterViewInit,
    AfterContentInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { SchemeProvider } from '../../provider';
import { Element } from './element';

import { ComplexFieldsModule } from './complex/module';

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
import { MatIcon } from '@angular/material/icon';

import * as els from './element';

@Component({
    selector: 'app-settings-scheme-element',
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
        MatIcon,
        ComplexFieldsModule,
        SchemeEntryElement,
    ],
    standalone: true,
})
@Initial()
@Ilc()
export class SchemeEntryElement extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() provider!: SchemeProvider;
    @Input() element!: Element;

    public elCheckboxElement: els.CheckboxElement | undefined;
    public elFilesFolderSelectorElement: els.FilesFolderSelectorElement | undefined;
    public elInputElement: els.InputElement<unknown> | undefined;
    public elListElement: els.ListElement<unknown> | undefined;
    public elNamedValuesElement: els.NamedValuesElement<unknown> | undefined;
    public elNestedDictionaryElement: els.NestedDictionaryElement<unknown> | undefined;
    public elTimezoneSelectorElement: els.TimezoneSelectorElement | undefined;
    public elFieldsCollectionElement: els.FieldsCollectionElement | undefined;

    public field: boolean = false;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.field = this.element.isField();
        this.elCheckboxElement =
            this.element.inner instanceof els.CheckboxElement ? this.element.inner : undefined;
        this.elFilesFolderSelectorElement =
            this.element.inner instanceof els.FilesFolderSelectorElement
                ? this.element.inner
                : undefined;
        this.elInputElement =
            this.element.inner instanceof els.InputElement ? this.element.inner : undefined;
        this.elListElement =
            this.element.inner instanceof els.ListElement ? this.element.inner : undefined;
        this.elNamedValuesElement =
            this.element.inner instanceof els.NamedValuesElement ? this.element.inner : undefined;
        this.elNestedDictionaryElement =
            this.element.inner instanceof els.NestedDictionaryElement
                ? this.element.inner
                : undefined;
        this.elTimezoneSelectorElement =
            this.element.inner instanceof els.TimezoneSelectorElement
                ? this.element.inner
                : undefined;
        this.elFieldsCollectionElement =
            this.element.inner instanceof els.FieldsCollectionElement
                ? this.element.inner
                : undefined;
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.element.subjects.get().loaded.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    public ngOnAddCollection() {
        if (!this.elFieldsCollectionElement) {
            return;
        }
        this.elFieldsCollectionElement.add();
        this.detectChanges();
    }
}
export interface SchemeEntryElement extends IlcInterface {}

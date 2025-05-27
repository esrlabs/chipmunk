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
import { SchemeProvider } from '../provider';
import { Element } from '../element';

import * as els from '../element';

@Component({
    selector: 'app-settings-scheme-element',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
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
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.element.subjects.get().loaded.subscribe(() => {
                this.detectChanges();
            }),
        );
    }
}
export interface SchemeEntryElement extends IlcInterface {}

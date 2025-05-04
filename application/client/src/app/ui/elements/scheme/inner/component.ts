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
import { FieldDesc, LazyFieldDesc, StaticFieldDesc, ValueInput } from '@platform/types/bindings';
import { Element } from '../element';

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

    public field: boolean = false;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.field = this.element.isField();
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

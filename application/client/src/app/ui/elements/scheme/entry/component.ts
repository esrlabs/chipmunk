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
    selector: 'app-settings-scheme-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class SchemeEntry extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() provider!: SchemeProvider;
    @Input() field!: FieldDesc;

    public pending: LazyFieldDesc | undefined;
    public loaded: StaticFieldDesc | undefined;
    public element: Element | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.pending = (this.field as { Lazy: LazyFieldDesc }).Lazy;
        this.loaded = (this.field as { Static: StaticFieldDesc }).Static;
        if (this.loaded) {
            this.element = new Element(this.loaded.id, this.loaded.interface);
            return;
        }
        this.env().subscriber.register(
            this.provider
                .subjects()
                .get()
                .loaded.subscribe((loaded: StaticFieldDesc) => {
                    if (!this.pending || this.pending.id !== loaded.id) {
                        return;
                    }
                    this.loaded = loaded;
                    this.pending = undefined;
                    this.element = new Element(this.loaded.id, this.loaded.interface);
                    this.detectChanges();
                }),
        );
    }

    public ngAfterViewInit(): void {
        this.detectChanges();
    }
}
export interface SchemeEntry extends IlcInterface {}

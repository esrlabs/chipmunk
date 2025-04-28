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
import { Element, ChangeEvent } from '../element';
import { WrappedField } from '../field';
@Component({
    selector: 'app-settings-scheme-entry-bound',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class SchemeEntryBound extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() provider!: SchemeProvider;
    @Input() fields!: FieldDesc[];

    public pending: Map<string, LazyFieldDesc> = new Map();
    public loaded: Map<string, StaticFieldDesc> = new Map();
    public elements: Map<string, Element> = new Map();
    public name!: string;
    public desc!: string;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.fields.forEach((field) => {
            const pending = (field as { Lazy: LazyFieldDesc }).Lazy;
            const loaded = (field as { Static: StaticFieldDesc }).Static;
            if (loaded) {
                const element = new Element(loaded.id, loaded.interface);
                this.env().subscriber.register(
                    element.changed.subscribe(this.onChanges.bind(this)),
                );
                this.elements.set(loaded.id, element);
                if (loaded.binding === undefined) {
                    this.desc = loaded.desc;
                    this.name = loaded.name;
                }
                this.loaded.set(loaded.id, loaded);
                return;
            }
            this.pending.set(pending.id, pending);
        });
        this.env().subscriber.register(
            this.provider
                .subjects()
                .get()
                .loaded.subscribe((loaded: StaticFieldDesc) => {
                    if (!this.pending.has(loaded.id)) {
                        return;
                    }
                    this.loaded.set(loaded.id, loaded);
                    const element = new Element(loaded.id, loaded.interface);
                    this.env().subscriber.register(
                        element.changed.subscribe(this.onChanges.bind(this)),
                    );
                    this.elements.set(loaded.id, element);
                    this.pending.delete(loaded.id);
                    this.detectChanges();
                }),
        );
    }

    public ngAfterViewInit(): void {
        this.detectChanges();
    }

    public onChanges(event: ChangeEvent) {
        const owner = this.loaded.get(event.uuid);
        if (!owner) {
            return;
        }
        if (!owner.binding) {
            return;
        }
        const bound = this.elements.get(owner.binding);
        if (bound === undefined) {
            return;
        }
        bound.setValue(event.value);
        this.detectChanges();
    }
}
export interface SchemeEntryBound extends IlcInterface {}

import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    AfterContentChecked,
    Input,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { SchemeProvider } from './provider';
import { FieldDesc } from '@platform/types/bindings';
import { WrappedField } from './field';

@Component({
    selector: 'app-settings-scheme',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class SettingsScheme
    extends ChangesDetector
    implements AfterContentInit, AfterContentChecked, AfterViewInit
{
    @Input() provider!: SchemeProvider;

    public single: FieldDesc[] = [];
    public bound: Map<string, FieldDesc[]> = new Map();

    protected id: string | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentChecked(): void {
        if (this.id === undefined || this.provider === undefined) {
            return;
        }
        if (this.id === this.provider.id) {
            return;
        }
        this.ngAfterViewInit();
    }
    public ngAfterContentInit(): void {}

    public ngAfterViewInit(): void {
        this.id = this.provider.id;
        this.provider
            .get()
            .then((fields) => {
                let bindings: string[] = [];
                fields.forEach((field) => {
                    const wrapped = new WrappedField(field);
                    if (wrapped.binding) {
                        bindings.push(wrapped.id);
                        if (!bindings.includes(wrapped.binding)) {
                            bindings.push(wrapped.binding);
                        }
                        let bound = this.bound.get(wrapped.binding);
                        bound = bound ? bound : [];
                        this.bound.set(wrapped.binding, bound);
                        if (bound.length === 0) {
                            const master = fields.find(
                                (field) => new WrappedField(field).id == wrapped.binding,
                            );
                            if (master === undefined) {
                                // TODO: report error
                                return;
                            }
                            bound.push(master);
                        }
                        bound.push(field);
                    }
                });
                this.single = fields.filter(
                    (field) => !bindings.includes(new WrappedField(field).id),
                );
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail get fields: ${err.message}`);
            });
    }
}
export interface SettingsScheme extends IlcInterface {}

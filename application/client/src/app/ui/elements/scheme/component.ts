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

    public fields: FieldDesc[] = [];

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
                this.fields = fields;
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail get fields: ${err.message}`);
            });
    }
}
export interface SettingsScheme extends IlcInterface {}

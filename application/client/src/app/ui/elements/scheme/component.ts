import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
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
    implements AfterContentInit, AfterContentChecked
{
    @Input() provider!: SchemeProvider;

    public fields: FieldDesc[] = [];

    protected uuid: string | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentChecked(): void {
        if (this.uuid === undefined || this.provider === undefined) {
            return;
        }
        if (this.uuid === this.provider.uuid) {
            return;
        }
        this.ngAfterContentInit();
    }
    public ngAfterContentInit(): void {
        this.fields = this.provider.getFieldDescs();
        this.uuid = this.provider.uuid;
    }
}
export interface SettingsScheme extends IlcInterface {}

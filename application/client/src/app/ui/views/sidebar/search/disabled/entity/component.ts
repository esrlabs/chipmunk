import { Component, AfterContentInit, ViewChild } from '@angular/core';
import { MatInput } from '@angular/material/input';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ProviderDisabled } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { EntityItem } from '../../base/entity';

@Component({
    selector: 'app-sidebar-disabled',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    hostDirectives: EntityItem.HOST_DIRECTIVES,
})
@Ilc()
export class Disabled
    extends EntityItem<ProviderDisabled, DisabledRequest>
    implements AfterContentInit
{
    @ViewChild(MatInput) _inputRefCom!: MatInput;

    public display_name: string | undefined;
    public icon: string | undefined;

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.provider.subjects.get().edit.subscribe((guid: string | undefined) => {
                if (this.entity.uuid() === guid) {
                    this.detectChanges();
                    if (this._inputRefCom !== undefined) {
                        this._inputRefCom.focus();
                    }
                }
            }),
        );
        const entity = this.entity.extract().entity();
        this.display_name = entity.disabled().displayName();
        this.icon = entity.disabled().icon();
    }
}
export interface Disabled extends IlcInterface {}

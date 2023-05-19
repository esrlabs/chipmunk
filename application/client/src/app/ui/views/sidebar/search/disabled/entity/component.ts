import { Component, Input, AfterContentInit, ViewChild } from '@angular/core';
import { MatInput } from '@angular/material/input';
// import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ProviderDisabled } from '../provider';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { DragAndDropService } from '../../draganddrop/service';
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

    @Input() draganddrop!: DragAndDropService;

    public _ng_display_name: string | undefined;
    public _ng_icon: string | undefined;

    // constructor(
    //     cdRef: ChangeDetectorRef,
    //     private _directive: EntityDirective,
    //     private _accessor: MatDragDropResetFeatureDirective,
    // ) {
    //     super(cdRef);
    //     this._ng_directive = _directive;
    //     this._ng_directive.setResetFeatureAccessorRef(_accessor);
    // }

    public ngAfterContentInit() {
        this.env().subscriber.register(
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                if (this.entity.uuid() === guid) {
                    this.detectChanges();
                    if (this._inputRefCom !== undefined) {
                        this._inputRefCom.focus();
                    }
                }
            }),
        );
        const entity = this.entity.extract().entity();
        this._ng_display_name = entity.disabled().displayName();
        this._ng_icon = entity.disabled().icon();
    }
}
export interface Disabled extends IlcInterface {}

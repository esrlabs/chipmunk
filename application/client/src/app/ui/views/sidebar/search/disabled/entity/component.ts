import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChild,
} from '@angular/core';
import { MatInput } from '@angular/material/input';
import { FilterItemDirective } from '../../directives/item.directive';
import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ProviderDisabled } from '../provider';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Entity } from '../../providers/definitions/entity';
import { DragAndDropService } from '../../draganddrop/service';

@Component({
    selector: 'app-sidebar-disabled',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Disabled extends ChangesDetector implements AfterContentInit {
    @ViewChild(MatInput) _inputRefCom!: MatInput;

    @Input() entity!: Entity<DisabledRequest>;
    @Input() provider!: ProviderDisabled;
    @Input() draganddrop!: DragAndDropService;

    public _ng_display_name: string | undefined;
    public _ng_icon: string | undefined;
    public _ng_directive: FilterItemDirective;

    constructor(
        cdRef: ChangeDetectorRef,
        private _directive: FilterItemDirective,
        private _accessor: MatDragDropResetFeatureDirective,
    ) {
        super(cdRef);
        this._ng_directive = _directive;
        this._ng_directive.setResetFeatureAccessorRef(_accessor);
    }

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

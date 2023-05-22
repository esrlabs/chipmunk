import {
    Component,
    ChangeDetectorRef,
    OnInit,
    Input,
    HostBinding,
    HostListener,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Provider, ISelectEvent } from '../providers/definitions/provider';
import { Entity } from '../providers/definitions/entity';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CdkDrag } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-sidebar-entity-item-base',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export abstract class EntityItem<P, T> extends ChangesDetector implements OnInit {
    static HOST_DIRECTIVES = [
        {
            directive: CdkDrag,
        },
    ];

    @Input() provider!: P & Provider<T>;
    @Input() entity!: Entity<T>;

    public edit: boolean = false;
    public selected: boolean = false;
    public dragging: boolean = false;

    private _ignore: boolean = false;

    @HostBinding('class.selected') get cssClassSelected() {
        return this.selected;
    }
    @HostBinding('class.edited') get cssClassEdited() {
        return this.edit;
    }
    @HostListener('click') onClick() {
        if (this._ignore) {
            this._ignore = false;
            return;
        }
        if (this.edit) {
            return;
        }
        this.provider !== undefined && this.provider.select().set({ guid: this.entity.uuid() });
        this.detectChanges();
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnInit() {
        this.env().subscriber.register(
            this.provider.subjects.get().edit.subscribe((guid: string | undefined) => {
                this.edit = this.entity.uuid() === guid;
                this.markChangesForCheck();
            }),
            this.provider.subjects.get().selection.subscribe((event: ISelectEvent) => {
                this.selected = event.guids.indexOf(this.entity.uuid()) !== -1;
                if (!this.selected) {
                    this.edit = false;
                }
                this.markChangesForCheck();
            }),
        );
        this.selected = this.provider.select().get().indexOf(this.entity.uuid()) !== -1;
    }

    public ignoreMouseClick() {
        this._ignore = true;
    }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EntityItem<P, T> extends IlcInterface {}

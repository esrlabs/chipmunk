import {
    Component,
    AfterViewInit,
    AfterContentInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    ViewEncapsulation,
    Input,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Entity } from './providers/entity';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State, CloseHandler } from './state';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InputFilter } from '@elements/filter/component';

@Component({
    selector: 'app-navigator',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class Navigator
    extends ChangesDetector
    implements AfterViewInit, AfterContentInit, OnDestroy
{
    @ViewChild('filter') public filterInputRef!: InputFilter;

    @Input() close: CloseHandler | undefined;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef, private readonly _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.state = new State(this);
        this.close !== undefined && this.state.bind(this.close);
    }

    public ngAfterViewInit(): void {
        this.bindFilterInput();
        this.env().subscriber.register(
            this.state.update.subscribe(() => {
                this.bindFilterInput();
                this.markChangesForCheck();
            }),
        );
    }

    public ngItemContextMenu(event: MouseEvent, entity: Entity) {
        this.ilc().emitter.ui.contextmenu.open({
            items: this.state.getContextMenu(entity),
            x: event.x,
            y: event.y,
        });
    }

    public ngAction(entity: Entity): void {
        this.state.action(entity);
    }

    // public addFolder(): void {
    //     this.state
    //         .selectAndAdd()
    //         .then(() => {
    //             this.state
    //                 .load()
    //                 .catch((err: Error) => {
    //                     this.log().error(`Fail to reload state favorites: ${err.message}`);
    //                 })
    //                 .finally(() => {
    //                     this.detectChanges();
    //                 });
    //         })
    //         .catch((err: Error) => {
    //             this.log().error(`Fail to add favorites: ${err.message}`);
    //         });
    // }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }

    public bindFilterInput() {
        this.detectChanges();
        this.filterInputRef !== undefined &&
            this.state.entries.filter.bind(this.filterInputRef.getInputElementRef()).focus();
    }
}
export interface Navigator extends IlcInterface {}

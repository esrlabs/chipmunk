import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    HostListener,
    OnDestroy,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';

@Component({
    selector: 'app-scrollarea-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class RowComponent
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() public row!: Row;

    public render: number = 1;

    private _subscriber: Subscriber = new Subscriber();

    @HostListener('mouseover', ['$event', '$event.target']) onMouseIn(
        _event: MouseEvent,
        _target: HTMLElement,
    ) {
        this.ilc().emitter.ui.row.hover(this.row);
    }

    @HostListener('mouseout', ['$event.target']) onMouseOut() {
        this.ilc().emitter.ui.row.hover(undefined);
    }

    @HostListener('mouseleave', ['$event.target']) onMouseLeave() {
        this.ilc().emitter.ui.row.hover(undefined);
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this._subscriber.unsubscribe();
    }

    public ngAfterContentInit(): void {
        this.render = this.row.session.render.delimiter() === undefined ? 1 : 2;
        this.ilc().channel.ui.row.rank((event) => {
            if (event.session !== this.row.session.uuid()) {
                return;
            }
            this.markChangesForCheck();
        });
        this._subscriber.register(
            this.row.change.subscribe(() => {
                this.markChangesForCheck();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.markChangesForCheck();
    }

    public ngGetRankFiller(position: number): string {
        return this.row.session.stream.rank.getFiller(position);
    }

    public ngGetSignatureWidth(): { [key: string]: string } {
        return {
            width: `${this.row.session.stream.rank.width()}px`,
        };
    }
}
export interface RowComponent extends IlcInterface {}

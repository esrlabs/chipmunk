import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    HostListener,
    HostBinding,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-scrollarea-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class RowComponent extends ChangesDetector implements AfterContentInit, AfterViewInit {
    @Input() public row!: Row;

    public render: number = 1;
    public bookmarked: boolean = false;

    @HostBinding('attr.data-selected') get dataSelectedAttr() {
        return this.row.select().is();
    }
    @HostListener('mouseover') onMouseIn() {
        this.ilc().emitter.ui.row.hover(this.row);
    }

    @HostListener('mouseout', ['$event.target']) onMouseOut() {
        this.ilc().emitter.ui.row.hover(undefined);
    }

    @HostListener('mouseleave', ['$event.target']) onMouseLeave() {
        this.ilc().emitter.ui.row.hover(undefined);
    }

    @HostListener('click') onClick() {
        this.row.select().toggle();
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.render = this.row.session.render.delimiter() === undefined ? 1 : 2;
        this.ilc().channel.ui.row.rank((event) => {
            if (event.session !== this.row.session.uuid()) {
                return;
            }
            this._update();
        });
        this.env().subscriber.register(this.row.change.subscribe(this._update.bind(this)));
        this.env().subscriber.register(
            this.row.session.bookmarks.subjects.get().updated.subscribe(this._update.bind(this)),
        );
        this.env().subscriber.register(
            this.row.session.cursor.subjects.get().updated.subscribe(this._update.bind(this)),
        );
        this._update();
    }

    public ngAfterViewInit(): void {
        this._update();
    }

    public ngGetRankFiller(position: number): string {
        return this.row.session.stream.rank.getFiller(position);
    }

    public ngGetSignatureWidth(): { [key: string]: string } {
        return {
            width: `${this.row.session.stream.rank.width()}px`,
        };
    }

    public onNumberClick() {
        this.row.bookmark().toggle();
    }

    private _update() {
        const prev = this.bookmarked;
        this.bookmarked = this.row.bookmark().is();
        if (prev !== this.bookmarked) {
            this.markChangesForCheck();
        }
    }
}
export interface RowComponent extends IlcInterface {}

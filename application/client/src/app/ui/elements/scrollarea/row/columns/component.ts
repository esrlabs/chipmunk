import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    HostBinding,
    ChangeDetectionStrategy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Row } from '@schema/content/row';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Subscriber } from '@platform/env/subscription';
import { Columns as ColumnsController } from '@schema/render/columns';
import { Cell } from './cell';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-scrollarea-row-columns',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
})
@Ilc()
export class Columns extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public row!: Row;

    public cells: Cell[] = [];
    public controller!: ColumnsController;

    private _sanitizer: DomSanitizer;
    private _subscriber: Subscriber = new Subscriber();

    constructor(cdRef: ChangeDetectorRef, sanitizer: DomSanitizer) {
        super(cdRef);
        this._sanitizer = sanitizer;
    }

    @HostBinding('class') classes = 'row noreset';
    // @HostBinding('attr.data-id') id = unique();

    // @HostBinding('style.background') background = '';
    // @HostBinding('style.color') color = '';

    public ngOnDestroy(): void {
        this._subscriber.unsubscribe();
    }

    public ngAfterContentInit(): void {
        this.controller = this.row.session.render.getBoundEntity() as ColumnsController;
        this.cells = this.row.columns().map((s, i) => {
            return new Cell(this._sanitizer, this.controller, s, i);
        });
        this._subscriber.register(
            this.controller.update.subscribe(() => {
                this.markChangesForCheck();
            }),
        );
        this._subscriber.register(
            this.row.change.subscribe(() => {
                this.row.columns().map((s, i) => {
                    if (this.cells[i] === undefined) {
                        this.log().error(`Column ${i} doesn't exist`);
                        return;
                    }
                    this.cells[i].update(s);
                });
                this.markChangesForCheck();
            }),
        );
    }


    public visible(): Cell[] {
        return this.cells.filter((c) => c.visible());
    }
}
export interface Columns extends IlcInterface {}

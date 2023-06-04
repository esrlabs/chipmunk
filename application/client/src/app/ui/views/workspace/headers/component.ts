import {
    Component,
    Input,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    AfterContentInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Columns, Header } from '@schema/render/columns';
import { Session } from '@service/session';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Direction } from '@directives/resizer';

class RenderedHeader {
    public caption: string;
    public styles: { [key: string]: string } = {};
    public width: LimittedValue | undefined;

    private _ref: Header;

    constructor(ref: Header) {
        this._ref = ref;
        this.caption = ref.caption;
        this.width = ref.width;
        this.width !== undefined && this.resize(this.width.value);
    }

    public resize(width: number) {
        if (this._ref.width === undefined || this.width === undefined) {
            return;
        }
        this._ref.width.set(width);
        this.styles = {
            width: `${this.width.value}px`,
            minWidth: `${this.width.value}px`,
        };
    }
}

@Component({
    selector: 'app-scrollarea-row-columns-headers',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class ColumnsHeaders extends ChangesDetector implements AfterContentInit {
    public readonly Direction = Direction;
    public offset: number = 0;

    @Input() public controller!: Columns;
    @Input() public session!: Session;

    public headers: RenderedHeader[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.stream.subjects.get().rank.subscribe(() => {
                this.markChangesForCheck();
            }),
        );
        this.headers = this.controller.headers
            .filter((h) => h.visible)
            .map((h) => new RenderedHeader(h));
        this.markChangesForCheck();
    }

    public ngGetOffsetStyle(): { [key: string]: string } {
        return {
            width: `${this.session.stream.rank.width()}px`,
            minWidth: `${this.session.stream.rank.width()}px`,
            marginLeft: `-${this.offset}px`,
        };
    }

    public ngResize(width: number, header: RenderedHeader, index: number) {
        header.resize(width);
        this.markChangesForCheck();
        this.controller.subjects.get().resized.emit(index);
    }

    public setOffset(left: number): void {
        this.offset = left;
        this.markChangesForCheck();
    }
}
export interface ColumnsHeaders extends IlcInterface {}

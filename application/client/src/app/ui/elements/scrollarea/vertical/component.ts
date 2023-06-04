import {
    Component,
    Input,
    AfterContentInit,
    AfterViewInit,
    HostListener,
    Output,
    EventEmitter,
    ElementRef,
    ChangeDetectorRef,
} from '@angular/core';
import { Service } from '../controllers/service';
import { Holder } from '../controllers/holder';
import { ChangesInitiator, Frame, PositionEvent } from '../controllers/frame';
import { LockToken } from '@ui/env/lock.token';
import { stop } from '@ui/env/dom';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Ilc, IlcInterface } from '@env/decorators/component';

const MAX_SCROLL_THUMB_HEIGHT: number = 20;

@Component({
    selector: 'app-scrollarea-vertical',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ScrollAreaVerticalComponent
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit
{
    @Input() public service!: Service;
    @Input() public holder!: Holder;
    @Input() public frame!: Frame;

    @Output() public scrolling = new EventEmitter<number>();

    private _height: number = 0;
    private _fillerHeight: number = 0;
    private _count: number = 0;
    private _rowsInView: number = 0;
    private _scrollEventLockToken: LockToken = new LockToken(-1);

    @HostListener('scroll', ['$event', '$event.target']) onScroll(
        event: MouseEvent,
        target: HTMLElement,
    ) {
        if (this._scrollEventLockToken.isLocked()) {
            return;
        }
        if (this._fillerHeight === 0) {
            return;
        }
        const rate = target.scrollTop / (target.scrollHeight - target.offsetHeight);
        const position = Math.round((this._count - this._rowsInView) * rate);
        this.scrolling.next(position);
    }

    @HostListener('mousedown') onMouseDown() {
        this._scrollEventLockToken.unlock();
    }

    @HostListener('window:mouseup') onWindowMouseUp() {
        this._scrollEventLockToken.lock();
    }

    @HostListener('wheel', ['$event']) onWheel(event: MouseEvent) {
        stop(event);
        return false;
    }

    constructor(cdRef: ChangeDetectorRef, private elRef: ElementRef<HTMLElement>) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this._scrollEventLockToken.lock();
        this._count = this.service.getLen();
        this.env().subscriber.register(
            this.service.onLen((len: number) => {
                this._count = len;
                this._calculate();
            }),
            this.holder.onHeightChange((height: number) => {
                this._height = height;
                this._calculate();
            }),
            this.frame.onPositionChange((event: PositionEvent) => {
                if (
                    event.initiator === ChangesInitiator.Scrolling ||
                    event.initiator === ChangesInitiator.RowsDelivered
                ) {
                    return;
                }
                const position = event.range.from / this._count;
                this.elRef.nativeElement.scrollTop =
                    this.elRef.nativeElement.scrollHeight * position;
            }),
        );
    }

    public ngAfterViewInit(): void {
        this._calculate();
    }

    public getFillerStyles(): { height: string } {
        return {
            height: `${this._fillerHeight}px`,
        };
    }

    private _calculate() {
        const fillerHeight: number = this._count * this.service.getItemHeight();
        this._rowsInView = Math.floor(this._height / this.service.getItemHeight());
        if (fillerHeight === 0 || this._height === 0 || this._height > fillerHeight) {
            this._fillerHeight = 0;
        } else {
            const rate: number = this._height / fillerHeight;
            const thumb: number = this._height * rate;
            if (thumb < MAX_SCROLL_THUMB_HEIGHT) {
                this._fillerHeight = this._height / (MAX_SCROLL_THUMB_HEIGHT / this._height);
            } else {
                this._fillerHeight = fillerHeight;
            }
        }
        this.markChangesForCheck();
    }
}
export interface ScrollAreaVerticalComponent extends IlcInterface {}

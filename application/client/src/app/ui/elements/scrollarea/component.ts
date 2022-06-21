import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    Input,
    AfterViewInit,
    ElementRef,
    ChangeDetectionStrategy,
    HostBinding,
} from '@angular/core';
import { Subscription } from '@platform/env/subscription';
import { Row } from '@schema/content/row';
import { Holder } from './controllers/holder';
import { Service } from './controllers/service';
import { Frame, ChangesInitiator } from './controllers/frame';
import { Selecting, SelectionDirection } from './controllers/selection';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { RemoveHandler } from '@ui/service/styles';
import { Ilc, IlcInterface } from '@env/decorators/component';

export interface IScrollBoxSelection {
    selection: string;
    original: string;
    anchor: number;
    anchorOffset: number;
    focus: number;
    focusOffset: number;
}

@Component({
    selector: 'app-scrollarea',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class ScrollAreaComponent extends ChangesDetector implements OnDestroy, AfterViewInit {
    @ViewChild('content_holder', { static: false }) _nodeHolder!: ElementRef<HTMLElement>;

    @Input() public service!: Service;

    private readonly _subscriptions: Map<string, Subscription> = new Map();
    private _cssClass: string = '';
    private _removeGlobalStyleHandler: RemoveHandler | undefined;

    @HostBinding('class') set cssClass(cssClass: string) {
        this._cssClass = cssClass;
    }
    get cssClass() {
        return this._cssClass;
    }

    public rows: Row[] = [];
    public readonly holder: Holder = new Holder();
    public readonly frame: Frame = new Frame();
    public readonly selecting: Selecting = new Selecting();
    public selectionDirection = SelectionDirection;

    constructor(changeDetectorRef: ChangeDetectorRef) {
        super(changeDetectorRef);
    }

    public ngOnDestroy(): void {
        this.detauchChangesDetector();
        this.holder.destroy();
        this.frame.destroy();
        this.selecting.destroy();
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.unsubscribe();
        });
    }

    public ngAfterViewInit(): void {
        this.holder.bind(this._nodeHolder);
        this.frame.bind(this.service, this.holder);
        this.selecting.bind(this._nodeHolder.nativeElement, this.frame);
        this._subscriptions.set(
            'onFrameChange',
            this.frame.onFrameChange((rows: Row[]) => {
                const exists = this.rows.length;
                rows.forEach((updated: Row, i: number) => {
                    if (i < exists) {
                        this.rows[i].from(updated);
                    } else {
                        this.rows.push(updated);
                    }
                });
                if (rows.length < exists) {
                    this.rows.splice(rows.length).forEach((row) => {
                        row.destroy();
                    });
                }
                this.detectChanges();
                this.selecting.restore();
            }),
        );
        this._subscriptions.set(
            'onSelectionStart',
            this.selecting.onSelectionStart(() => {
                this.cssClass = 'selecting';
                this._removeGlobalStyleHandler = this.ilc().services.ui.styles
                    .add(`:not(.selecting *) {
					user-select: none;
				}`);
            }),
        );
        this._subscriptions.set(
            'onSelectionFinish',
            this.selecting.onSelectionFinish(() => {
                this.cssClass = '';
                if (typeof this._removeGlobalStyleHandler === 'function') {
                    this._removeGlobalStyleHandler();
                    this._removeGlobalStyleHandler = undefined;
                }
            }),
        );
        this.frame.init();
    }

    public getFrameStart(): number {
        return this.frame.get().from;
    }

    public onScrolling(position: number) {
        this.frame.moveTo(position, ChangesInitiator.Scrolling);
    }

    public onWheel(event: WheelEvent) {
        if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            this.frame.offsetTo(event.deltaY, ChangesInitiator.Wheel);
            event.preventDefault();
        }
    }

    public showSelectionDetectors(): boolean {
        return this._removeGlobalStyleHandler !== undefined;
    }

    public onMouseMoveSelectionDetector(direction: SelectionDirection) {
        this.selecting.doSelectionInDirection(direction);
    }
}
export interface ScrollAreaComponent extends IlcInterface {}

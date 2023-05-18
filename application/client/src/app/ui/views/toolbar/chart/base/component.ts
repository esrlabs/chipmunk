import {
    Component,
    Input,
    ViewChild,
    OnDestroy,
    AfterViewInit,
    ChangeDetectorRef,
    ElementRef,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '../state';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-views-chart-base',
    template: '',
})
@Ilc()
export class OutputBase extends ChangesDetector implements AfterViewInit, OnDestroy {
    @Input() public session!: Session;
    @Input() public state!: State;

    @ViewChild('canvas') canvasElRef!: ElementRef<HTMLCanvasElement>;

    public rect: { width: number; height: number } = { width: 100, height: 100 };

    protected elRef: ElementRef<HTMLElement>;
    protected resizeObserve!: ResizeObserver;

    constructor(chRef: ChangeDetectorRef, elRef: ElementRef<HTMLElement>) {
        super(chRef);
        this.elRef = elRef;
    }

    public ngOnDestroy(): void {
        this.resizeObserve.disconnect();
    }

    public ngAfterViewInit(): void {
        this.resizeObserve = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            if (entries.length !== 1) {
                return;
            }
            const rect = entries[0].contentRect;
            const changes = {
                height: this.rect.height !== rect.height,
                width: this.rect.width !== rect.width,
            };
            this.rect = rect;
            this.detectChanges();
            if (changes.width) {
                this.state.cursor.setWidth(this.rect.width);
            } else if (!changes.width && changes.height) {
                this.session.charts.refresh();
            }
        });
        this.resizeObserve.observe(this.elRef.nativeElement);
        this.rect = this.elRef.nativeElement.getBoundingClientRect();
        this.detectChanges();
        this.state.cursor.setWidth(this.rect.width);
    }
}
export interface OutputBase extends IlcInterface {}

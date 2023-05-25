import { Component, Input, ChangeDetectorRef, AfterViewInit, HostListener } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '../state';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { stop } from '@ui/env/dom';

enum Target {
    Left = 'left',
    Right = 'right',
    Move = 'move',
    Select = 'select',
    None = 'none',
}

@Component({
    selector: 'app-views-chart-cursor',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewChartCursor extends ChangesDetector implements AfterViewInit {
    public readonly Target = Target;

    @Input() public session!: Session;
    @Input() public state!: State;

    @HostListener('window:mousemove', ['$event']) mousemove(event: MouseEvent): void {
        if (this.selecting.x !== -1) {
            const diff = event.x - this.selecting.x;
            this.selecting.x = event.x;
            this.selecting.w += diff;
            if (this.selecting.w < 0) {
                this.selecting.leftPx = `${this.selecting.l + this.selecting.w}px`;
            } else {
                this.selecting.leftPx = `${this.selecting.l}px`;
            }
            this.selecting.widthPx = `${Math.abs(this.selecting.w)}px`;
        } else {
            if (this.movement.target === Target.None) {
                return;
            }
            const diff = event.x - this.movement.x;
            if (this.movement.target === Target.Left) {
                this.state.cursor.change(diff).left();
            } else if (this.movement.target === Target.Right) {
                this.state.cursor.change(diff).right();
            } else if (this.movement.target === Target.Move) {
                this.state.cursor.change(diff).move();
            }
            this.movement.x = event.x;
        }
    }

    @HostListener('window:mouseup', ['$event']) mouseup(_event: MouseEvent): void {
        if (this.selecting.x !== -1) {
            const left = (() => {
                if (this.selecting.w < 0) {
                    return this.selecting.l + this.selecting.w;
                } else {
                    return this.selecting.l;
                }
            })();
            this.state.cursor.fromPx(left, Math.abs(this.selecting.w));
        }
        this.movement.target = Target.None;
        this.movement.x = 0;
        this.selecting.x = -1;
    }

    @HostListener('wheel', ['$event']) wheel(event: WheelEvent): void {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            this.state.cursor
                .change(Math.round(event.deltaY / State.REDUCE_ZOOM_ON_WHEEL))
                .resize();
        } else {
            this.state.cursor.change(Math.round(event.deltaX / State.REDUCE_MOVE_ON_WHEEL)).move();
        }
        stop(event);
    }

    @HostListener('mousedown', ['$event']) mousedown(event: MouseEvent): void {
        this.selecting.x = event.x;
        this.selecting.w = 0;
        this.selecting.l = event.x;
        this.selecting.leftPx = `${event.x}px`;
        this.selecting.widthPx = `0px`;
        stop(event);
    }

    protected movement: {
        target: Target;
        x: number;
    } = {
        target: Target.None,
        x: 0,
    };

    protected selecting: {
        x: number;
        w: number;
        l: number;
        leftPx: string;
        widthPx: string;
    } = {
        w: 0,
        x: -1,
        l: 0,
        leftPx: '',
        widthPx: '',
    };

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.state.cursor.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    public mousedownOnFrame(event: MouseEvent, target: Target): void {
        if (target === Target.Select) {
            this.mousedown(event);
        } else {
            this.movement.target = target;
            this.movement.x = event.x;
        }
        stop(event);
    }

    public wheelOnFrame(event: WheelEvent): void {
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            this.state.cursor
                .change(Math.round(event.deltaY / State.REDUCE_ZOOM_ON_WHEEL))
                .resize();
        } else {
            this.state.cursor.change(Math.round(event.deltaX / State.REDUCE_MOVE_ON_WHEEL)).move();
        }
        stop(event);
    }
}
export interface ViewChartCursor extends IlcInterface {}

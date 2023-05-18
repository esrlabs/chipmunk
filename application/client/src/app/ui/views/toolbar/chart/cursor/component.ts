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

    @HostListener('window:mouseup', ['$event']) mouseup(_event: MouseEvent): void {
        this.movement.target = Target.None;
        this.movement.x = 0;
    }

    @HostListener('wheel', ['$event']) wheel(event: WheelEvent): void {
        this.state.cursor.change(Math.round(event.deltaY / State.REDUCE_MOVE_ON_WHEEL)).move();
        stop(event);
    }

    protected movement: {
        target: Target;
        x: number;
    } = {
        target: Target.None,
        x: 0,
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

    public mousedown(event: MouseEvent, target: Target): void {
        this.movement.target = target;
        this.movement.x = event.x;
        stop(event);
    }

    public zoom(event: WheelEvent): void {
        this.state.cursor.change(Math.round(event.deltaY / State.REDUCE_ZOOM_ON_WHEEL)).resize();
        stop(event);
    }
}
export interface ViewChartCursor extends IlcInterface {}

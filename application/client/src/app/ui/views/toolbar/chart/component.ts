import {
    Component,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    OnDestroy,
    HostBinding,
    HostListener,
} from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { State } from './state';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { unique } from '@platform/env/sequence';

const STATE_ID_REF = unique();

@Component({
    selector: 'app-views-chart',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewChart extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public session!: Session;

    @HostBinding('attr.tabindex') get tabindex() {
        return 0;
    }
    @HostListener('focus', ['$event.target']) onFocus() {
        this.focused = true;
    }
    @HostListener('blur', ['$event.target']) onBlur() {
        this.focused = false;
    }

    @HostListener('keyup', ['$event']) keyup(event: KeyboardEvent): void {
        if (!this.focused) {
            return;
        }
        if (event.key === 'ArrowLeft') {
            this.state.cursor.change(Math.round(-State.KEY_MOVE_STEP)).move();
        } else if (event.key === 'ArrowRight') {
            this.state.cursor.change(Math.round(State.KEY_MOVE_STEP)).move();
        }
    }

    protected focused = false;

    public state: State = new State();

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
    }

    public ngOnDestroy(): void {
        this.session.storage.set(STATE_ID_REF, this.state);
    }

    public ngAfterContentInit(): void {
        const state = this.session.storage.get<State>(STATE_ID_REF);
        this.state = state === undefined ? this.state : state;
        this.state.init(this, this.session);
    }
}
export interface ViewChart extends IlcInterface {}

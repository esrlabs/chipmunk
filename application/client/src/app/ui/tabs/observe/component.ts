import {
    Component,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
    Input,
    AfterContentInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State, IApi, IInputs } from './state';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-tabs-observe',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class TabObserve extends ChangesDetector implements AfterContentInit, OnDestroy {
    // This method is used only to highlight inputs of component
    static inputs(inputs: IInputs): IInputs {
        return inputs;
    }

    @Input() observe!: Observe;
    @Input() api!: IApi;

    public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterContentInit(): void {
        this.state = new State(this, this.observe);
    }
}
export interface TabObserve extends IlcInterface {}

import {
    Component,
    OnDestroy,
    ViewChild,
    Input,
    AfterViewInit,
    ChangeDetectorRef,
    ElementRef,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { FavouriteInput } from './input';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../state';

@Component({
    selector: 'app-elements-tree-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ElementsTreeSelectorInput extends ChangesDetector implements AfterViewInit, OnDestroy {
    @ViewChild('favouriteinput') favouriteInputRef!: ElementRef<HTMLInputElement>;
    @Input() state!: State;

    public readonly input = new FavouriteInput();

    constructor(chRef: ChangeDetectorRef) {
        super(chRef);
    }

    public ngOnDestroy(): void {
        this.input.destroy();
    }

    public ngAfterViewInit(): void {
        this.input.actions.accept.subscribe((path: string) => {
            this.state.addPlace(path);
        });
        // this.input.actions.edit.subscribe(() => {
        //     if (this.active === undefined) {
        //         return;
        //     }
        //     this.input.set(this.active.filter.filter);
        //     this.onActiveDrop();
        //     this.markChangesForCheck();
        // });
        // this.input.actions.recent.subscribe(() => {
        //     this.markChangesForCheck();
        // });
    }

    public ngOnKeyUpInput(event: KeyboardEvent) {
        this.input.keyup(event);
    }
}
export interface ElementsTreeSelectorInput extends IlcInterface {}

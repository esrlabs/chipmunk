import {
    Component,
    Input,
    AfterViewInit,
    ViewChild,
    ElementRef,
    ChangeDetectorRef,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Session } from '@service/session';
import { State } from './state';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-views-content-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ViewContentMapComponent extends ChangesDetector implements AfterViewInit {
    @ViewChild('canvas') canvasElementRef!: ElementRef<HTMLCanvasElement>;
    @Input() public session!: Session;

    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef, private elRef: ElementRef) {
        super(cdRef);
    }

    public ngAfterViewInit(): void {
        this.state.init(
            this.session,
            this.elRef.nativeElement,
            this.canvasElementRef.nativeElement,
            this.detectChanges.bind(this),
        );
        this.env().subscriber.register(
            this.session.search.subjects.get().updated.subscribe((_event) => {
                this.state.update();
            }),
        );
        this.env().subscriber.register(
            this.session.search
                .store()
                .filters()
                .subjects.get()
                .highlights.subscribe(() => {
                    this.state.draw();
                }),
        );
        this.ilc().channel.ui.toolbar.resize(() => {
            this.state.resize().update();
        });
    }
}
export interface ViewContentMapComponent extends IlcInterface {}

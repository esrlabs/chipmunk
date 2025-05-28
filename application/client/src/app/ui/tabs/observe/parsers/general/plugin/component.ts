import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Observe } from '@platform/types/observe';
import { State } from './state';

@Component({
    selector: 'app-el-parser-plugin-general',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class ParserPluginGeneralConfiguration
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit
{
    @Input() observe!: Observe;
    @Input() path!: string | undefined;

    protected state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterContentInit(): void {
        this.state = new State(this.observe, this.path);
        this.state.bind(this);
        this.env().subscriber.register(
            this.observe.parser.subscribe(() => {
                if (!this.path) {
                    return;
                }
                this.state.setPath(this.path);
            }),
        );
    }

    public update(): void {
        this.state.update();
    }

    ngAfterViewInit(): void {
        this.state.init();
        this.detectChanges();
    }
}

export interface ParserPluginGeneralConfiguration extends IlcInterface {}

import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    ViewChild,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Observe } from '@platform/types/observe';
import { State } from './state';
import { ConfigSchemas } from '@ui/tabs/observe/config-schema/component';

@Component({
    selector: 'app-el-parser-plugin-general',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ParserPluginGeneralConfiguration
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit
{
    @Input() observe!: Observe;

    @ViewChild('cschema') configsComponent!: ConfigSchemas;

    protected state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterContentInit(): void {
        this.state = new State(this.observe);
        this.state.bind(this);
    }

    public update(): void {
        this.state.update();
        this.configsComponent.reload();
    }

    ngAfterViewInit(): void {
        this.state
            .load()
            .then(() => {
                this.configsComponent.reload();
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(
                    `Fail to restore plugin parser configuration with: ${err.message}`,
                );
            });
    }
}

export interface ParserPluginGeneralConfiguration extends IlcInterface {}

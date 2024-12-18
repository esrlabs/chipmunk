import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Observe } from '@platform/types/observe';

@Component({
    selector: 'app-el-parser-plugin-general',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ParserPluginGeneralConfiguration {
    @Input() observe!: Observe;
}

export interface ParserPluginGeneralConfiguration extends IlcInterface {}

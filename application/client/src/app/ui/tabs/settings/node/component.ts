import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Node } from '../node';

@Component({
    selector: 'app-tabs-settings-node',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SettingsNode extends ChangesDetector {
    @Input() public node!: Node;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface SettingsNode extends IlcInterface {}

import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { CColors } from '@styles/colors';

@Component({
    selector: 'app-dialogs-color-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class ColorSelector extends ChangesDetector {
    @Input() public done!: (color: string | undefined) => void;
    @Input() public color!: string | undefined;

    public colors: string[] = CColors.slice();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface ColorSelector extends IlcInterface {}

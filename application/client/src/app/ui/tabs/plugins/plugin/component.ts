import { Component, ChangeDetectorRef, Input, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginDesc } from '../desc';
import { Provider } from '../provider';

@Component({
    selector: 'app-plugins-manager-plugin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class Plugin extends ChangesDetector {
    @Input() public provider!: Provider;
    @Input() public plugin!: PluginDesc;

    @HostListener('click', ['$event']) onClick(_event: MouseEvent) {
        this.provider.select(this.plugin.entity.dir_path);
    }
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}

export interface Plugin extends IlcInterface {}

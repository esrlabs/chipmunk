import { Component, ChangeDetectorRef, Input, HostListener, HostBinding } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginDescription } from '../desc';
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
    @Input() public plugin!: PluginDescription;

    @HostListener('click', ['$event']) onClick(_event: MouseEvent) {
        this.provider.select(this.plugin.getPath());
    }
    @HostBinding('class') get getClass() {
        return !this.provider.selected
            ? ''
            : this.provider.selected.getPath() === this.plugin.getPath()
            ? 'selected'
            : '';
    }
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}

export interface Plugin extends IlcInterface {}

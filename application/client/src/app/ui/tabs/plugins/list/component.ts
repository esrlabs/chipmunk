import { Component, ChangeDetectorRef, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Provider } from '../provider';
import { PluginDescription } from '../desc';

export enum Target {
    Installed,
    Invalid,
    Available,
}

@Component({
    selector: 'app-plugins-manager-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class List extends ChangesDetector implements AfterContentInit {
    @Input() public provider!: Provider;
    @Input() public target!: Target;

    public plugins: PluginDescription[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.provider.subjects.get().load.subscribe(() => {
                this.update();
            }),
            this.provider.subjects.get().state.subscribe(() => {
                this.update();
            }),
        );
    }

    public getTitle(): string {
        switch (this.target) {
            case Target.Installed:
                return 'Installed Plugins';
            case Target.Invalid:
                return 'Invalid Plugins';
            case Target.Available:
                return 'Available Plugins';
        }
    }

    protected update() {
        switch (this.target) {
            case Target.Installed:
                this.plugins = this.provider.get().installed();
                break;
            case Target.Invalid:
                this.plugins = this.provider.get().invalid();
                break;
            case Target.Available:
                this.plugins = this.provider.get().available();
                break;
        }
        this.detectChanges();
    }
}

export interface List extends IlcInterface {}

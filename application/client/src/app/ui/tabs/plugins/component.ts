import { Component, ChangeDetectorRef, AfterContentInit, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
//TODO:
// import { State } from './state';

@Component({
    selector: 'app-tabs-plugins-manager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class PluginsManager extends ChangesDetector implements AfterContentInit {
    @Input() public allPlugins!: string;
    @Input() public activePlugins!: string;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public onReloadClick(): void {
        this.allPlugins = 'Loading ...';
        this.activePlugins = 'Loading ...';
        this.detectChanges();

        this.ilc()
            .services.system.plugins.reloadPlugins()

            .then(() => {
                this.loadPlugins();
            })
            .catch((err: Error) => {
                this.log().error(`Error while reloading: ${err}`);
            });
    }

    loadPlugins(): void {
        this.ilc()
            .services.system.plugins.allPlugins()
            .then((plugins) => {
                const plugins_pretty = JSON.stringify(plugins, null, 2);

                this.allPlugins = plugins_pretty;
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get all plugins: ${err}`);
            });

        this.ilc()
            .services.system.plugins.activePlugins()
            .then((activePlugins) => {
                const plugins_pretty = JSON.stringify(activePlugins, null, 2);
                this.activePlugins = plugins_pretty;
                this.detectChanges();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get active plugins: ${err}`);
            });
    }

    public ngAfterContentInit(): void {
        this.loadPlugins();
    }
}

export interface PluginsManager extends IlcInterface {}

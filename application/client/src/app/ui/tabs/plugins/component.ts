import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
//TODO:
// import { State } from './state';

@Component({
    selector: 'app-tabs-plugins-manager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class PluginsManager extends ChangesDetector implements AfterContentInit {
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        //TODO AAZ: Remove debug code once done.
        this.log().debug(`After initial plugins manager`);
        this.ilc()
            .services.system.plugins.allPlugins()
            .then((pluginsJson) => {
                this.log().debug(`All Plugins: ${pluginsJson}`);
                return this.ilc().services.system.plugins.activePlugins();
            })
            .then((activePluginsJson) => {
                this.log().debug(`Active Plugins: ${activePluginsJson}`);
                return this.ilc().services.system.plugins.reloadPlugins();
            })
            .then(() => {
                this.log().debug('Reload finished');
                return this.ilc().services.system.plugins.allPlugins();
            })
            .then((pluginsJson) => {
                this.log().debug(`All Plugins After Reload: ${pluginsJson}`);
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get all plugins: ${err}`);
            });
    }
}

export interface PluginsManager extends IlcInterface {}

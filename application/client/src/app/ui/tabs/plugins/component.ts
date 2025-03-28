import { Component, ChangeDetectorRef, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Provider } from './provider';
import { Target } from './list/component';
import { bridge } from '@service/bridge';

@Component({
    selector: 'app-tabs-plugins-manager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class PluginsManager extends ChangesDetector implements AfterContentInit, OnDestroy {
    public provider: Provider = new Provider();

    public get Target(): typeof Target {
        return Target;
    }
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.provider.destroy();
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.provider.subjects.get().state.subscribe(() => {
                this.detectChanges();
            }),
            this.provider.subjects.get().selected.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.provider.load();
    }

    public async reload() {
        await this.provider.load(true);
    }

    public async addPlugin() {
        await bridge
            .folders()
            .select()
            .then((dirs: string[]) => {
                if (dirs.length === 0) {
                    return Promise.resolve();
                }
                return this.provider.addPlugin(dirs[0]);
            })
            .catch((err: Error) => {
                console.error(`Error while opening folders: ${err.message}`);
            });
    }
}

export interface PluginsManager extends IlcInterface {}

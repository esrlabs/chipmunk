import { Component, ChangeDetectorRef, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Provider } from './provider';
import { Target } from './list/component';
import { bridge } from '@service/bridge';
import { Notification, notifications } from '@ui/service/notifications';
import { error } from '@platform/log/utils';

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
            this.provider.subjects.get().add.subscribe(() => {
                this.detectChanges();
            }),
            this.provider.subjects.get().remove.subscribe(() => {
                this.detectChanges();
            }),
        );
        this.provider.load();
    }

    public async reload() {
        if (this.provider.isBusy()) {
            return;
        }
        await this.provider.load(true);
    }

    public async addPlugin() {
        if (this.provider.isBusy()) {
            return;
        }
        try {
            const folder = await bridge.folders().select();
            if (folder.length === 0) {
                return;
            }
            await this.provider.addPlugin(folder[0]);
            this.reload();
            notifications.notify(
                new Notification({
                    message: `New plugin has been added`,
                    actions: [],
                }),
            );
        } catch (err) {
            notifications.notify(
                new Notification({
                    message: this.log().error(`Fail to add plugin: ${error(err)}`),
                    actions: [],
                    pinned: true,
                }),
            );
        }
    }
}

export interface PluginsManager extends IlcInterface {}

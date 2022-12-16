import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ISettingsEntry } from '@platform/types/settings/entry';
import { Render } from '@platform/types/settings/entry.description';

@Component({
    selector: 'app-tabs-settings-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class SettingsEntry extends ChangesDetector {
    public readonly Render = Render;

    @Input() public entry!: ISettingsEntry;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public save(entry: ISettingsEntry) {
        this.ilc()
            .services.system.settings.set(entry.desc.path, entry.desc.key, entry.value)
            .catch((err: Error) => {
                this.log().error(
                    `Fail to save ${entry.desc.path}::${entry.desc.key}; error: ${err.message}`,
                );
            });
    }
}
export interface SettingsEntry extends IlcInterface {}

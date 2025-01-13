import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ISettingsEntry } from '@platform/types/settings/entry';
import { popup, Vertical, Horizontal } from '@ui/service/popup';
import { components } from '@env/decorators/initial';
import { getContrastColor } from '@styles/colors';

@Component({
    selector: 'app-tabs-settings-entry-color',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class SettingsEntryColor extends ChangesDetector implements AfterContentInit {
    @Input() public entry!: ISettingsEntry;
    @Input() public save!: (entry: ISettingsEntry) => void;

    public color: string | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.color =
            this.entry.value !== undefined
                ? (this.entry.value as string)
                : (this.ilc().services.system.settings.getDefaultByDesc(this.entry.desc) as
                      | string
                      | undefined);
    }

    public styles(): { [key: string]: string | undefined } {
        return {
            background: this.color as string,
            color: this.color !== undefined ? getContrastColor(this.color, true) : undefined,
        };
    }

    public change(): void {
        const dialog = popup.open({
            component: {
                factory: components.get('app-dialogs-color-selector'),
                inputs: {
                    done: (color: string | undefined) => {
                        this.color = color;
                        this.entry.value = color;
                        this.save(this.entry);
                        dialog.close();
                        this.detectChanges();
                    },
                    color: this.entry.value,
                },
            },
            position: {
                vertical: Vertical.center,
                horizontal: Horizontal.center,
            },
            closeOnKey: '*',
            uuid: 'Color Selection',
        });
    }

    public drop() {
        this.entry.value = undefined;
        this.save(this.entry);
        this.ngAfterContentInit();
        this.detectChanges();
    }
}
export interface SettingsEntryColor extends IlcInterface {}

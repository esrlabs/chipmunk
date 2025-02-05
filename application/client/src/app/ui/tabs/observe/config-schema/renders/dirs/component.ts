import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings';
import { State } from '../../state';
import { bridge } from '@service/bridge';

@Component({
    selector: 'app-tabs-config-schema-dirs',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfigSchemaDirs extends ChangesDetector {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public paths: string[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnAddButtonkclick(): void {
        bridge
            .folders()
            .select()
            .then((dirs: string[]) => {
                dirs = dirs.filter((added) => {
                    return this.paths.find((exist) => exist === added) === undefined;
                });
                this.paths = this.paths.concat(dirs);
            })
            .catch((err: Error) => {
                console.error(`Error while opening folders: ${err.message}`);
            })
            .finally(() => {
                this.update();
                this.detectChanges();
            });
    }

    public ngOnRemovePath(dir: string): void {
        this.paths = this.paths.filter((f) => f !== dir);
        this.update();
        this.detectChanges();
    }

    update(): void {
        this.state.saveConfig(this.config.id, { Directories: this.paths });
    }
}

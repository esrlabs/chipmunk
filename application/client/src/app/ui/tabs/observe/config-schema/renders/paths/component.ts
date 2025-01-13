import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings';
import { State } from '../../state';
import { File } from '@platform/types/files';
import { bridge } from '@service/bridge';

@Component({
    selector: 'app-tabs-config-schema-paths',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ConfigSchemaPaths extends ChangesDetector {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public paths: File[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnAddButtonkclick(): void {
        bridge
            .files()
            .select.custom('*')
            .then((files: File[]) => {
                files = files.filter((added) => {
                    return (
                        this.paths.find((exist) => exist.filename === added.filename) === undefined
                    );
                });
                this.paths = this.paths.concat(files);
            })
            .catch((_err: Error) => {
                // TODO AAZ: Errors ignored for now
            })
            .finally(() => {
                this.update();
                this.detectChanges();
            });
    }

    public ngOnRemovePath(file: File): void {
        this.paths = this.paths.filter((f) => f.filename !== file.filename);
        this.update();
        this.detectChanges();
    }

    update(): void {
        const files = this.paths.map((p) => p.filename);
        this.state.saveConfig(this.config.id, { Paths: files });
    }
}

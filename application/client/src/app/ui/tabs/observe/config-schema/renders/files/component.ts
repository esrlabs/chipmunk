import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings';
import { State } from '../../state';
import { File } from '@platform/types/files';
import { bridge } from '@service/bridge';

@Component({
    selector: 'app-tabs-config-schema-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfigSchemaFiles extends ChangesDetector implements AfterContentInit {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public paths: File[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnAddButtonkclick(): void {
        const inputType = this.config.input_type;
        const exts =
            typeof inputType === 'object' && 'Files' in inputType && inputType.Files.length > 0
                ? inputType.Files.join(',')
                : '*';
        bridge
            .files()
            .select.custom(exts)
            .then((files: File[]) => {
                files = files.filter((added) => {
                    return (
                        this.paths.find((exist) => exist.filename === added.filename) === undefined
                    );
                });
                this.paths = this.paths.concat(files);
            })

            .catch((err: Error) => {
                console.error(`Error while opening folders: ${err.message}`);
            })
            .finally(() => {
                this.update();
                this.detectChanges();
            });
    }

    ngAfterContentInit(): void {
        this.update();
    }

    public ngOnRemovePath(file: File): void {
        this.paths = this.paths.filter((f) => f.filename !== file.filename);
        this.update();
        this.detectChanges();
    }

    update(): void {
        const files = this.paths.map((p) => p.filename);
        this.state.saveConfig(this.config.id, { Files: files });
    }
}

import { PluginEntity } from '@platform/types/bindings/plugins';
import { bridge } from '@service/bridge';
import { ParsedPath } from '@platform/types/files';

export class PluginDesc {
    public name: string = '';
    public desc: string = '';
    public icon: string = '';
    public path: ParsedPath | undefined;

    constructor(public readonly entity: PluginEntity) {}

    public load(): Promise<void> {
        return bridge
            .files()
            .name(this.entity.dir_path)
            .then((path: ParsedPath) => {
                this.path = path;
                this.update();
            });
    }

    protected update() {
        this.icon = this.getIcon();
        this.name = this.getName();
        this.desc = this.getDesc();
    }

    protected getIcon(): string {
        switch (this.entity.plugin_type) {
            case 'Parser':
                return 'swap_vert';
            case 'ByteSource':
                return 'input';
        }
    }

    protected getName(): string {
        if (!this.entity.metadata && !this.path) {
            return this.entity.dir_path;
        } else if (!this.entity.metadata && this.path) {
            return this.path.name;
        } else if (this.entity.metadata) {
            return this.entity.metadata.name;
        } else {
            return this.entity.dir_path;
        }
    }

    protected getDesc(): string {
        if (!this.entity.metadata && !this.path) {
            return this.entity.dir_path;
        } else if (!this.entity.metadata && this.path) {
            return this.path.name;
        } else if (this.entity.metadata && this.entity.metadata.description) {
            return this.entity.metadata.description;
        } else {
            return this.entity.dir_path;
        }
    }
}

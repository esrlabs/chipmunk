import { PluginEntity, InvalidPluginEntity } from '@platform/types/bindings/plugins';
import { bridge } from '@service/bridge';
import { ParsedPath } from '@platform/types/files';

export abstract class PluginDescription {
    public name: string = '';
    public desc: string = '';
    public icon: string = '';
    public path: ParsedPath | undefined;
    public readmePath: string | undefined;

    protected abstract getName(): string;
    protected abstract getDesc(): string;
    protected abstract getIcon(): string;
    protected abstract getReadmePath(): string | undefined;

    protected update() {
        this.icon = this.getIcon();
        this.name = this.getName();
        this.desc = this.getDesc();
        this.readmePath = this.getReadmePath();
    }

    public abstract getPath(): string;
    public abstract isValid(): boolean;

    public load(): Promise<void> {
        return bridge
            .files()
            .name(this.getPath())
            .then((path: ParsedPath) => {
                this.path = path;
                this.update();
            });
    }
}

export class InstalledPluginDesc extends PluginDescription {
    constructor(public readonly entity: PluginEntity) {
        super();
    }
    protected override getIcon(): string {
        switch (this.entity.plugin_type) {
            case 'Parser':
                return 'swap_vert';
            case 'ByteSource':
                return 'input';
        }
    }
    protected override getName(): string {
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
    protected override getDesc(): string {
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
    public override getPath(): string {
        return this.entity.dir_path;
    }
    public override getReadmePath(): string | undefined {
        return this.entity.readme_path ?? undefined;
    }
    public override isValid(): boolean {
        return true;
    }
}

export class InvalidPluginDesc extends PluginDescription {
    constructor(public readonly entity: InvalidPluginEntity) {
        super();
    }
    protected override getIcon(): string {
        switch (this.entity.plugin_type) {
            case 'Parser':
                return 'swap_vert';
            case 'ByteSource':
                return 'input';
        }
    }
    protected override getName(): string {
        if (!this.path) {
            return this.entity.dir_path;
        } else {
            return this.path.name;
        }
    }
    protected override getDesc(): string {
        if (!this.path) {
            return this.entity.dir_path;
        } else {
            return this.path.name;
        }
    }
    public override getPath(): string {
        return this.entity.dir_path;
    }
    public override getReadmePath(): string | undefined {
        return undefined;
    }
    public override isValid(): boolean {
        return false;
    }
}

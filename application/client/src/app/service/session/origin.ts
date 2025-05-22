import { SourceOrigin, Ident, SessionSetup, ComponentOptions } from '@platform/types/bindings';

export class SessionComponents {
    public parser: Ident | undefined;
    public source: Ident | undefined;
}

export class ComponentsOptions {
    public parser: ComponentOptions | undefined;
    public source: ComponentOptions | undefined;
    public setParser(options: ComponentOptions): ComponentsOptions {
        this.parser = options;
        return this;
    }
    public setSource(options: ComponentOptions): ComponentsOptions {
        this.source = options;
        return this;
    }
}

export class SessionSourceOrigin {
    static file(path: string): SessionSourceOrigin {
        return new SessionSourceOrigin({ File: path }, undefined);
    }
    static files(paths: string[]): SessionSourceOrigin {
        return new SessionSourceOrigin({ Files: paths }, undefined);
    }
    static source(): SessionSourceOrigin {
        return new SessionSourceOrigin('Source', undefined);
    }

    public readonly options: ComponentsOptions;

    constructor(
        public readonly origin: SourceOrigin,
        public components: SessionComponents | undefined,
    ) {
        this.options = new ComponentsOptions();
    }

    public setComponents(components: SessionComponents) {
        this.components = components;
    }

    public getSessionSetup(): SessionSetup {
        if (!this.options.parser) {
            throw new Error(`Parser isn't defined`);
        }
        if (!this.options.source) {
            throw new Error(`Source isn't defined`);
        }
        return {
            origin: this.origin,
            source: this.options.source,
            parser: this.options.parser,
        };
    }

    public getDef(): SourceOrigin {
        return this.origin;
    }
    public getTitle(): string {
        if (this.origin === 'Source') {
            // TODO: Check idents
            return `Source`;
        } else if ((this.origin as { File: string }).File) {
            return (this.origin as { File: string }).File;
        } else if ((this.origin as { Files: string[] }).Files) {
            return `${(this.origin as { Files: string[] }).Files.length} files`;
        } else {
            return `unknown`;
        }
    }
    public getDescription(): { title: string; desctiption: string | undefined } {
        if (this.origin === 'Source') {
            // TODO: Check idents
            return {
                title: 'Custom Source',
                desctiption: `Data comes from selected source provider`,
            };
        } else if ((this.origin as { File: string }).File) {
            return { title: `Selected File`, desctiption: (this.origin as { File: string }).File };
        } else if ((this.origin as { Files: string[] }).Files) {
            return {
                title: `Collection of Files`,
                desctiption: `${(this.origin as { Files: string[] }).Files.length} files`,
            };
        } else {
            return { title: 'Unknown', desctiption: undefined };
        }
    }
}

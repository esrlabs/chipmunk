import {
    SessionAction,
    Ident,
    SessionSetup,
    ComponentOptions,
    OutputRender,
    SessionDescriptor,
} from '@platform/types/bindings';
import { Render } from '@schema/render';
import { ColumnsRender } from '@schema/render/columns';
import { TextRender } from '@schema/render/text';
import { components } from '@service/components';

export class SessionComponents {
    public parser: Ident | undefined;
    public source: Ident | undefined;
    public setParser(ident: Ident): SessionComponents {
        this.parser = ident;
        return this;
    }
    public setSource(ident: Ident): SessionComponents {
        this.source = ident;
        return this;
    }
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

export class SessionOrigin {
    static fromSessionSetup(setup: SessionSetup, descriptor: SessionDescriptor): SessionOrigin {
        return new SessionOrigin(
            setup.origin,
            new SessionComponents().setSource(descriptor.source).setParser(descriptor.source),
            new ComponentsOptions().setParser(setup.parser).setSource(setup.source),
        );
    }

    static file(path: string): SessionOrigin {
        return new SessionOrigin({ File: path }, undefined);
    }
    static files(paths: string[]): SessionOrigin {
        return new SessionOrigin({ Files: paths }, undefined);
    }
    static source(): SessionOrigin {
        return new SessionOrigin('Source', undefined);
    }

    public readonly options: ComponentsOptions;

    constructor(
        public readonly origin: SessionAction,
        public components: SessionComponents | undefined,
        options?: ComponentsOptions,
    ) {
        this.options = options ? options : new ComponentsOptions();
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

    public getDef(): SessionAction {
        return this.origin;
    }

    public getRender(): Promise<Render<any>> {
        const parser = this.options.parser;
        if (!parser) {
            return Promise.reject(new Error(`No parsed defined`));
        }
        return new Promise((resolve, reject) => {
            components
                .getOutputRender(parser.uuid)
                .then((render: OutputRender | null | undefined) => {
                    if (!render) {
                        reject(new Error(`No output render for parser ${parser.uuid}`));
                        return;
                    }
                    if (render === 'PlaitText') {
                        return resolve(new TextRender());
                    } else if (typeof render === 'object') {
                        if ((render as { Columns: Array<[string, number]> }).Columns) {
                            const schema = (render as { Columns: Array<[string, number]> }).Columns;
                            return resolve(
                                new ColumnsRender(
                                    schema.map((data: [string, number]) => data[0]),
                                    schema.map((data: [string, number]) => data[1]),
                                ),
                            );
                        }
                    }
                })
                .catch(reject);
        });
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

    public isSdeSupported(): Promise<boolean> {
        if (!this.options || !this.options.source) {
            return Promise.reject(new Error(`Source isn't defined`));
        }
        return components.isSdeSupported(this.options.source.uuid, this.origin);
    }

    public isFile(): boolean {
        return typeof (this.origin as { File: string }).File === 'string';
    }

    public isFiles(): boolean {
        return (this.origin as { Files: string[] }).Files instanceof Array;
    }

    public isStream(): boolean {
        return typeof this.origin === 'string' && this.origin === 'Source';
    }

    public isSameAction(other: SessionAction): boolean {
        if ((this.origin as { File: string }).File && (other as { File: string }).File) {
            return true;
        } else if (
            (this.origin as { Files: string[] }).Files &&
            (other as { Files: string[] }).Files
        ) {
            return true;
        } else if (this.origin === 'Source' && other === 'Source') {
            return true;
        } else {
            return false;
        }
    }

    public getFirstFilename(): string | undefined {
        if ((this.origin as { File: string }).File) {
            return (this.origin as { File: string }).File;
        } else if ((this.origin as { Files: string[] }).Files) {
            const files = (this.origin as { Files: string[] }).Files;
            return files.length > 0 ? files[0] : undefined;
        } else {
            return undefined;
        }
    }
    public getFiles(): string[] | undefined {
        if ((this.origin as { Files: string[] }).Files) {
            const files = (this.origin as { Files: string[] }).Files;
            return files instanceof Array ? files : undefined;
        } else {
            return undefined;
        }
    }
}

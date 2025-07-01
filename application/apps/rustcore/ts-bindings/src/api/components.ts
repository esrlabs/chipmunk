import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { v4 as uuid } from 'uuid';
import { Base as Native } from '../native/native.components';
import { ComponentsEventProvider, IComponentsEvents } from '../api/components.provider';
import { Subscriber } from 'platform/env/subscription';
import {
    ComponentsOptionsList,
    Field,
    FieldDesc,
    FieldsValidationErrors,
    Ident,
    OutputRender,
    SessionAction,
} from 'platform/types/bindings';

import {
    InvalidPluginEntity,
    InvalidPluginsList,
    PluginEntity,
    PluginsList,
    PluginsPathsList,
    PluginRunData,
} from 'platform/types/bindings/plugins';

export class Components extends Subscriber {
    private readonly native: Native;
    private readonly provider: ComponentsEventProvider;
    private readonly logger: Logger;
    private readonly uuid: string = uuid();

    constructor(resolver: (err: Error | undefined) => void) {
        super();
        this.logger = scope.getLogger(`Components: ${this.uuid}`);
        this.provider = new ComponentsEventProvider(this.uuid);
        this.native = new Native(this.provider, (err: Error | undefined) => {
            if (err instanceof Error) {
                this.logger.error(`Fail to create a components session: ${err.message}`);
            }
            resolver(err);
        });
    }

    static create(): Promise<Components> {
        return new Promise((resolve, reject) => {
            const components = new Components((err: Error | undefined) => {
                if (err instanceof Error) {
                    reject(err);
                } else {
                    resolve(components);
                }
            });
        });
    }

    public destroy(): Promise<void> {
        return this.native.destroy().catch((err: Error) => {
            this.logger.error(`Fail to destroy session: ${err.message}`);
            return Promise.reject(err);
        });
    }

    public getEvents(): IComponentsEvents {
        if (this.provider === undefined) {
            throw new Error(`EventProvider wasn't created`);
        }
        return this.provider.getEvents();
    }

    public get(origin: SessionAction): {
        sources(): Promise<Ident[]>;
        parsers(): Promise<Ident[]>;
    } {
        return {
            sources: (): Promise<Ident[]> => {
                return this.native.getComponents(origin, 'Source');
            },
            parsers: (): Promise<Ident[]> => {
                return this.native.getComponents(origin, 'Parser');
            },
        };
    }

    public getOptions(origin: SessionAction, targets: string[]): Promise<Map<string, FieldDesc[]>> {
        return this.native
            .getOptions(origin, targets)
            .then((list: ComponentsOptionsList) => list.options);
    }

    public getOutputRender(uuid: string): Promise<OutputRender | null> {
        return this.native.getOutputRender(uuid);
    }

    public getIdent(uuid: string): Promise<Ident | null> {
        return this.native.getIdent(uuid);
    }

    public validate(
        origin: SessionAction,
        target: string,
        fields: Field[],
    ): Promise<Map<string, string>> {
        return this.native
            .validate(origin, target, fields)
            .then((list: FieldsValidationErrors) => list.errors);
    }

    public abort(fields: string[]): Error | undefined {
        return this.native.abort(fields);
    }

    public installedPluginsList(): Promise<PluginEntity[]> {
        return this.native.installedPluginsList();
    }

    public invalidPluginsList(): Promise<InvalidPluginEntity[]> {
        return this.native.invalidPluginsList();
    }

    public installedPluginsPaths(): Promise<string[]> {
        return this.native.installedPluginsPaths();
    }

    public invalidPluginsPaths(): Promise<string[]> {
        return this.native.invalidPluginsPaths();
    }

    public installedPluginsInfo(plugin_path: string): Promise<PluginEntity | undefined> {
        return this.native.installedPluginsInfo(plugin_path);
    }

    public invalidPluginsInfo(plugin_path: string): Promise<InvalidPluginEntity | undefined> {
        return this.native.invalidPluginsInfo(plugin_path);
    }

    public getPluginRunData(plugin_path: string): Promise<PluginRunData | undefined> {
        return this.native.getPluginRunData(plugin_path);
    }

    public reloadPlugins(): Promise<void> {
        return this.native.reloadPlugins();
    }

    public addPlugin(plugin_path: string): Promise<void> {
        return this.native.addPlugin(plugin_path);
    }

    public removePlugin(plugin_path: string): Promise<void> {
        return this.native.removePlugin(plugin_path);
    }
}

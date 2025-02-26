import { State as Base } from '../../state';
import { Observe } from '@platform/types/observe';
import { plugins } from '@service/plugins';
import { getSafeFileName } from '@platform/types/files';
import { Subject } from '@platform/env/subscription';

import * as Plugin from '@platform/types/observe/parser/plugin';
import {
    PluginEntity,
    PluginConfigSchemaItem,
    PluginConfigValue,
} from '@platform/types/bindings/plugins';

export class State extends Base {
    public parsers: PluginEntity[] = [];
    public path: string | undefined;
    public selectedParser?: PluginEntity;
    public selected: Subject<PluginEntity> = new Subject();

    constructor(observe: Observe, path: string | undefined) {
        super(observe);
        this.path = path;
    }

    public init() {
        const conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            this.ref.log().error(`Currnet parser configuration must match plugin parser`);
            return;
        }
        this.parsers = plugins
            .list()
            .preload()
            .filter((p) => p.plugin_type === 'Parser');

        if (this.parsers.length > 0) {
            this.selectedParser = this.path
                ? this.parsers.find((p) => p.dir_path == this.path)
                : this.parsers[0];
            this.update();
        }
    }

    public setPath(path: string) {
        this.path = path;
        if (this.parsers.length > 0) {
            this.selectedParser = this.path
                ? this.parsers.find((p) => p.dir_path == this.path)
                : this.parsers[0];
            this.update();
        }
    }

    /**
     * Saves the given value to the tab configurations
     * @param id - ID of the configuration entry
     * @param value - Value of the configuration
     */
    public saveConfig(id: string, value: PluginConfigValue) {
        const conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            this.ref.log().error(`Currnet parser configuration must match plugin parser`);
            return;
        }

        const item = conf.configuration.plugin_configs.find((item) => item.id === id);
        if (item !== undefined) {
            item.value = value;
        } else {
            conf.configuration.plugin_configs.push({ id, value });
        }
    }

    /**
     * Updates the configuration data for the parser in the current tab
     */
    public update() {
        const conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            return;
        }

        const pluginPath = this.selectedParser?.info.wasm_file_path ?? '';

        if (conf.configuration.plugin_path !== pluginPath) {
            conf.configuration.plugin_path = pluginPath;
            // Clear configurations on plugin change.
            conf.configuration.plugin_configs = [];
        }
        this.selectedParser && this.selected.emit(this.selectedParser);
    }

    public getPluginName(parser: PluginEntity): string {
        return parser.metadata?.name ?? getSafeFileName(parser.dir_path);
    }

    public getPluginConfigs(parser?: PluginEntity): PluginConfigSchemaItem[] {
        return parser?.info.config_schemas ?? [];
    }
}

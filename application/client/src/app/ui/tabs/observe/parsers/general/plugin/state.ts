import { State as Base } from '../../state';
import { Observe } from '@platform/types/observe';
import { plugins as plugService } from '@service/plugins';
import { getSafeFileName } from '@platform/types/files';

import * as Plugin from '@platform/types/observe/parser/plugin';
import {
    PluginEntity,
    PluginConfigSchemaItem,
    PluginConfigValue,
} from '@platform/types/bindings/plugins';

export class State extends Base {
    public parsers: PluginEntity[] = [];
    public selectedParser?: PluginEntity;

    constructor(observe: Observe) {
        super(observe);
    }

    public async load(): Promise<void> {
        let conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            this.ref.log().error(`Currnet parser configuration must match plugin parser`);
            return;
        }

        this.parsers = await plugService.activePlugins().then((plugins) => {
            return plugins.filter((p) => p.plugin_type === 'Parser');
        });

        if (this.parsers.length > 0) {
            this.selectedParser = this.parsers[0];
            this.update();
        }
    }

    /**
     * Saves the given value to the tab configurations
     * @param id - ID of the configuration entry
     * @param value - Value of the configuration
     */
    public saveConfig(id: string, value: PluginConfigValue) {
        let conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
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
        let conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            this.ref.log().error(`Currnet parser configuration must match plugin parser`);
            return;
        }

        const state = this.selectedParser?.state;
        const pluginPath = state && 'Active' in state ? state.Active.wasm_file_path : '';

        if (conf.configuration.plugin_path !== pluginPath) {
            conf.configuration.plugin_path = pluginPath;
            // Clear configurations on plugin change.
            conf.configuration.plugin_configs = [];
        }
    }

    public getPluginName(parser: PluginEntity): string {
        return parser.metadata?.name ?? getSafeFileName(parser.dir_path);
    }

    public getPluginConfigs(parser?: PluginEntity): PluginConfigSchemaItem[] {
        const state = this.selectedParser?.state;
        return state && 'Active' in state ? state.Active.config_schemas : [];
    }
}

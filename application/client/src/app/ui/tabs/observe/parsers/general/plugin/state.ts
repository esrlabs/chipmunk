import { State as Base } from '../../state';
import { Observe } from '@platform/types/observe';
import { plugins as plugService } from '@service/plugins';
import { getSafeFileName } from '@platform/types/files';

import * as Plugin from '@platform/types/observe/parser/plugin';
import { PluginEntity, PluginType, ConfigSchema, ConfigValue } from '@platform/types/plugins';

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
            return plugins.filter((p) => p.plugin_type == PluginType.Parser);
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
    public saveConfig(id: string, value: ConfigValue) {
        let conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            this.ref.log().error(`Currnet parser configuration must match plugin parser`);
            return;
        }

        const item = conf.configuration.pluginConfigs.find((item) => item.id === id);
        if (item !== undefined) {
            item.value = value;
        } else {
            conf.configuration.pluginConfigs.push({ id, value });
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

        if (conf.configuration.pluginDirPath !== this.selectedParser?.dir_path) {
            conf.configuration.pluginDirPath = this.selectedParser?.dir_path ?? '';
            // Clear configurations on plugin change.
            conf.configuration.pluginConfigs = [];
        }
    }

    public getPluginName(parser: PluginEntity): string {
        return parser.metadata?.name ?? getSafeFileName(parser.dir_path);
    }

    public getPluginConfigs(parser?: PluginEntity): ConfigSchema[] {
        return parser?.state.Active?.config_schemas ?? [];
    }
}

import { State as Base } from '../../state';
import { Observe } from '@platform/types/observe';
import { plugins as plugService } from '@service/plugins';
import { getSafeFileName } from '@platform/types/files';

import * as Plugin from '@platform/types/observe/parser/plugin';
import { PluginEntity, PluginType } from '@platform/types/plugins';

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

        this.selectedParser = this.parsers[0];
    }

    public update(): State {
        let conf = this.observe.parser.as<Plugin.Configuration>(Plugin.Configuration);
        if (conf === undefined) {
            this.ref.log().error(`Currnet parser configuration must match plugin parser`);
            return this;
        }

        conf.configuration.pluginDirPath = this.selectedParser?.dir_path ?? '';

        return this;
    }

    public getPluginName(parser: PluginEntity): string {
        return parser.metadata?.name ?? getSafeFileName(parser.dir_path);
    }
}

import { plugins } from '@service/plugins';
import { InvalidPluginEntity, PluginEntity, PluginRunData } from '@platform/types/bindings/plugins';
import { Subjects, Subject } from '@platform/env/subscription';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';
import { InstalledPluginDesc, InvalidPluginDesc, PluginDescription } from './desc';
import { bridge } from '@service/bridge';

export class Provider {
    protected log: Logger;
    protected readonly plugins: {
        invalid: InvalidPluginDesc[];
        installed: InstalledPluginDesc[];
        available: InstalledPluginDesc[];
    } = {
        invalid: [],
        installed: [],
        available: [],
    };

    public subjects: Subjects<{
        load: Subject<void>;
        state: Subject<void>;
        selected: Subject<string>;
    }> = new Subjects({
        load: new Subject<void>(),
        state: new Subject<void>(),
        selected: new Subject<string>(),
    });
    public selected: PluginDescription | undefined;
    public state: {
        loading: boolean;
        error: string | undefined;
    } = {
        loading: false,
        error: undefined,
    };

    constructor() {
        this.log = scope.getLogger(`Plugins Provider`);
    }

    public load(): Promise<void> {
        if (this.state.loading) {
            return Promise.resolve();
        }
        this.state.loading = true;
        this.subjects.get().state.emit();
        return Promise.all([plugins.listIntalled(), plugins.listInvalid()])
            .then((loaded: [PluginEntity[], InvalidPluginEntity[]]) => {
                this.plugins.installed = loaded[0].map((en) => new InstalledPluginDesc(en));
                this.plugins.invalid = loaded[1].map((en) => new InvalidPluginDesc(en));
                this.state.error = undefined;
            })
            .catch((err: Error) => {
                this.log.error(`Fail to load plugins, due error: ${err.message}`);
                this.state.error = err.message;
            })
            .finally(() => {
                Promise.all([
                    ...this.plugins.installed.map((pl) => pl.load()),
                    ...this.plugins.invalid.map((pl) => pl.load()),
                ])
                    .catch((err: Error) => {
                        this.log.error(`Fail load some plugins data: ${err.message}`);
                    })
                    .then(() => {
                        this.state.loading = false;
                        this.subjects.get().state.emit();
                        this.subjects.get().load.emit();
                    });
            });
    }

    public destroy() {
        this.subjects.destroy();
    }

    public get(): {
        /// List of installed plugins
        installed(): InstalledPluginDesc[];
        /// List of available plugins (on remove source)
        available(): InstalledPluginDesc[];
        /// List of invalid plugins (installed, but not inited)
        invalid(): InvalidPluginDesc[];
    } {
        return {
            installed: (): InstalledPluginDesc[] => {
                return this.plugins.installed;
            },
            available: (): InstalledPluginDesc[] => {
                return this.plugins.available;
            },
            invalid: (): InvalidPluginDesc[] => {
                return this.plugins.invalid;
            },
        };
    }
    public async readme(pluginFolderPath: string): Promise<string | undefined> {
        const delimiter = await bridge.folders().delimiter();
        const readmePath = `${pluginFolderPath}${delimiter}README.md`;
        if (!(await bridge.files().exists(readmePath))) {
            return Promise.resolve(undefined);
        }
        return bridge.files().read(readmePath);
    }
    public getRunData(path: string): Promise<PluginRunData | undefined> {
        return plugins.getPluginRunData(path);
    }
    public select(path: string) {
        this.selected = [
            ...this.plugins.installed,
            ...this.plugins.available,
            ...this.plugins.invalid,
        ].find((pl) => pl.entity.dir_path === path);
        this.subjects.get().selected.emit(path);
    }
}

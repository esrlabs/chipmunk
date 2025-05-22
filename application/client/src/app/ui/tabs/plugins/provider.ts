import { plugins } from '@service/plugins';
import { InvalidPluginEntity, PluginEntity, PluginRunData } from '@platform/types/bindings/plugins';
import { Subjects, Subject } from '@platform/env/subscription';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';
import { InstalledPluginDesc, InvalidPluginDesc, PluginDescription } from './desc';
import { bridge } from '@service/bridge';
import { error } from '@platform/log/utils';

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
        selected: Subject<string | undefined>;
        // true - add starting; false - finished
        add: Subject<boolean>;
        // true - add starting; false - finished
        remove: Subject<boolean>;
    }> = new Subjects({
        load: new Subject<void>(),
        state: new Subject<void>(),
        selected: new Subject<string | undefined>(),
        add: new Subject<boolean>(),
        remove: new Subject<boolean>(),
    });
    public selected: PluginDescription | undefined;
    public state: {
        loading: boolean;
        adding: boolean;
        removing: boolean;
        error: string | undefined;
    } = {
        loading: false,
        adding: false,
        removing: false,
        error: undefined,
    };

    constructor() {
        this.log = scope.getLogger(`Plugins Provider`);
    }

    public async load(reload: boolean = false): Promise<void> {
        if (this.state.loading) {
            return Promise.resolve();
        }
        this.select(undefined);
        this.state.loading = true;
        if (reload) {
            await plugins
                .reloadPlugins()
                .catch((err: Error) => this.log.error(`Fail to reload plugins: ${err.message}`));
        }
        this.subjects.get().state.emit();
        return Promise.all([plugins.list().installed(), plugins.list().invalid()])
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
                        if (reload) {
                            // Apply changes on selected plugins by invoking select on it again.
                            const selectedPath = this.selected?.getPath();
                            if (selectedPath !== undefined) {
                                this.select(selectedPath);
                            }
                        }
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
    public async readme(readmePath: string): Promise<string | undefined> {
        if (!(await bridge.files().exists(readmePath))) {
            return Promise.resolve(undefined);
        }
        return bridge.files().read(readmePath);
    }
    public getRunData(path: string): Promise<PluginRunData | undefined> {
        return plugins.getPluginRunData(path);
    }
    public select(path: string | undefined) {
        this.selected = !path
            ? undefined
            : [...this.plugins.installed, ...this.plugins.available, ...this.plugins.invalid].find(
                  (pl) => pl.entity.dir_path === path,
              );
        this.subjects.get().selected.emit(path);
    }
    public addPlugin(pluginPath: string): Promise<void> {
        if (this.isBusy()) {
            return Promise.reject(
                new Error(
                    `Cannot add plugin, because previous plugin operation is still in progress.`,
                ),
            );
        }
        this.state.adding = true;
        this.subjects.get().add.emit(this.state.adding);
        return plugins.addPlugin(pluginPath).finally(() => {
            this.state.adding = false;
            this.subjects.get().add.emit(this.state.adding);
        });
    }
    public async removePlugin(pluginPath: string): Promise<void> {
        if (this.isBusy()) {
            return Promise.reject(
                new Error(
                    `Cannot add plugin, because previous plugin operation is still in progress.`,
                ),
            );
        }
        this.state.removing = true;
        this.subjects.get().remove.emit(this.state.removing);
        try {
            await plugins.removePlugin(pluginPath);
            await this.load(true);
            const selected = this.selected;
            if (selected !== undefined) {
                if (
                    [
                        ...this.plugins.installed,
                        ...this.plugins.available,
                        ...this.plugins.invalid,
                    ].find((pl) => pl.entity.dir_path === selected.getPath()) !== undefined
                ) {
                    this.selected = undefined;
                }
            }
            this.state.removing = false;
            this.subjects.get().remove.emit(this.state.removing);
            this.subjects.get().state.emit();
            return Promise.resolve();
        } catch (err) {
            this.state.removing = false;
            this.subjects.get().remove.emit(this.state.removing);
            return Promise.reject(new Error(error(err)));
        }
    }
    public isBusy(): boolean {
        return this.state.adding || this.state.loading || this.state.removing;
    }
}

import { plugins } from '@service/plugins';
import { InvalidPluginEntity, PluginEntity } from '@platform/types/bindings/plugins';
import { Subjects, Subject } from '@platform/env/subscription';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';
import { PluginDesc } from './desc';

export class Provider {
    protected log: Logger;
    protected readonly plugins: {
        all: PluginDesc[];
        active: PluginDesc[];
    } = {
        all: [],
        active: [],
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
    public selected: PluginDesc | undefined;
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
        return (
            Promise.all([plugins.listIntalled(), plugins.listInvalid()])
                // TODO: Fixes to make it compile only.
                .then((loaded: [PluginEntity[], InvalidPluginEntity[]]) => {
                    this.plugins.all = loaded[0].map((en) => new PluginDesc(en));
                    this.plugins.active = loaded[0].map((en) => new PluginDesc(en));
                    this.state.error = undefined;
                })
                .catch((err: Error) => {
                    this.log.error(`Fail to load plugins, due error: ${err.message}`);
                    this.state.error = err.message;
                })
                .finally(() => {
                    Promise.all([
                        ...this.plugins.active.map((pl) => pl.load()),
                        ...this.plugins.all.map((pl) => pl.load()),
                    ])
                        .catch((err: Error) => {
                            this.log.error(`Fail load some plugins data: ${err.message}`);
                        })
                        .then(() => {
                            this.state.loading = false;
                            this.subjects.get().state.emit();
                            this.subjects.get().load.emit();
                        });
                })
        );
    }

    public destroy() {
        this.subjects.destroy();
    }

    public get(): {
        /// List of active plugins
        active(): PluginDesc[];
        /// List of not active plugins
        available(): PluginDesc[];
        /// List of all plugins (active + available)
        all(): PluginDesc[];
    } {
        return {
            active: (): PluginDesc[] => {
                return this.plugins.active;
            },
            available: (): PluginDesc[] => {
                const all = this.plugins.all;
                return this.plugins.all.filter((plugin) => {
                    return (
                        all.find((pl) => pl.entity.dir_path == plugin.entity.dir_path) == undefined
                    );
                });
            },
            all: (): PluginDesc[] => {
                return this.plugins.all;
            },
        };
    }
    public select(path: string) {
        this.selected = [...this.plugins.active, ...this.plugins.all].find(
            (pl) => pl.entity.dir_path === path,
        );
        this.subjects.get().selected.emit(path);
    }
}

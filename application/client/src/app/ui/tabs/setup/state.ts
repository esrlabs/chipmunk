import { Ident, IODataType } from '@platform/types/bindings';
import { components, isIOCompatible } from '@service/components';
import { Logger } from '@env/logs';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { Proivder } from './provider';
import { SessionOrigin } from '@service/session/origin';

export interface IApi {
    finish(origin: SessionOrigin): Promise<string>;
    cancel(): void;
}

export interface ComponentDescription {
    ident: Ident;
    full: string;
}

export class State extends Subscriber {
    public sources: Ident[] = [];
    public parsers: Ident[] = [];
    public subjects: Subjects<{
        sources: Subject<Ident[]>;
        parsers: Subject<Ident[]>;
        error: Subject<string>;
        errorStateChange: Subject<void>;
        updated: Subject<void>;
    }> = new Subjects({
        sources: new Subject(),
        parsers: new Subject(),
        error: new Subject(),
        errorStateChange: new Subject(),
        updated: new Subject(),
    });
    public selected: {
        source: string | undefined;
        parser: string | undefined;
    } = {
        source: undefined,
        parser: undefined,
    };
    public description: {
        source: ComponentDescription | undefined;
        parser: ComponentDescription | undefined;
    } = {
        source: undefined,
        parser: undefined,
    };
    public providers: {
        source: Proivder | undefined;
        parser: Proivder | undefined;
    } = {
        source: undefined,
        parser: undefined,
    };
    public preselected: {
        parser: string | undefined;
        source: string | undefined;
    } = {
        parser: undefined,
        source: undefined,
    };
    public locked: boolean = false;

    protected readonly logger = new Logger(`Setup`);

    constructor(
        protected readonly origin: SessionOrigin,
        parser: string | undefined,
        source: string | undefined,
    ) {
        super();
        this.preselected.parser = parser;
        this.preselected.source = source;
        this.load();
    }
    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }
    public setSourceOrigin(origin: SessionOrigin): Error | undefined {
        if (!this.providers.parser || !this.providers.source) {
            return new Error(`Source or parser isn't setup`);
        }
        if (this.locked) {
            return new Error(`Not valid options`);
        }
        origin.options.setSource({
            uuid: this.providers.source.uuid,
            fields: this.providers.source.getFields(),
        });
        origin.options.setParser({
            uuid: this.providers.parser.uuid,
            fields: this.providers.parser.getFields(),
        });
        return undefined;
    }
    private async load() {
        const [sources, parsers]: [Ident[] | void, Ident[] | void] = await Promise.all([
            components
                .get(this.origin.getDef())
                .sources()
                .catch((err: Error) => {
                    this.logger.error(`Fail to get sources list: ${err.message}`);
                    this.subjects.get().error.emit(err.message);
                }),
            components
                .get(this.origin.getDef())
                .parsers()
                .catch((err: Error) => {
                    this.logger.error(`Fail to get parsers list: ${err.message}`);
                    this.subjects.get().error.emit(err.message);
                }),
        ]);
        if (!sources || !parsers) {
            return;
        }
        this.sources = sources;
        if (
            this.preselected.source &&
            this.sources.find((source) => source.uuid === this.preselected.source)
        ) {
            this.selected.source = this.preselected.source;
        } else if (this.sources.length > 0) {
            this.preselected.source = undefined;
            this.selected.source = this.sources[0].uuid;
        }
        this.parsers = parsers;
        if (
            this.preselected.parser &&
            this.parsers.find((parser) => parser.uuid === this.preselected.parser)
        ) {
            this.selected.parser = this.preselected.parser;
        } else if (this.parsers.length > 0) {
            this.preselected.parser = undefined;
            this.selected.parser = this.parsers[0].uuid;
        }
        this.subjects.get().sources.emit(this.sources);
        this.subjects.get().parsers.emit(this.parsers);
        this.change().source();
        this.change().parser();
    }

    public change(): {
        source(): void;
        parser(): void;
    } {
        return {
            source: (): void => {
                if (this.selected.source === undefined) {
                    return;
                }
                if (this.providers.source !== undefined) {
                    this.providers.source.destroy().catch((err: Error) => {
                        this.logger.error(`Fail to destroy source provider: ${err.message}`);
                    });
                }
                this.providers.source = undefined;
                this.description.source = undefined;
                const ident = this.sources.find((ident) => ident.uuid == this.selected.source);
                if (ident !== undefined) {
                    this.description.source = { full: '', ident };
                }
                const provider = new Proivder(this.origin, this.selected.source);
                provider
                    .load()
                    .then(() => {
                        this.register(
                            provider.subjects.get().error.subscribe(() => {
                                this.checkErrors();
                                this.subjects.get().errorStateChange.emit();
                            }),
                        );
                        this.providers.source = provider;
                    })
                    .catch((err: Error) => {
                        this.logger.error(`Fail load source options desc: ${err.message}`);
                    })
                    .finally(() => {
                        this.subjects.get().updated.emit();
                        this.checkCompatibility();
                    });
            },
            parser: (): void => {
                if (this.selected.parser === undefined) {
                    return;
                }
                if (this.providers.parser !== undefined) {
                    this.providers.parser.destroy().catch((err: Error) => {
                        this.logger.error(`Fail to destroy parser provider: ${err.message}`);
                    });
                }
                this.providers.parser = undefined;
                this.description.parser = undefined;
                const ident = this.parsers.find((ident) => ident.uuid == this.selected.parser);
                if (ident !== undefined) {
                    this.description.parser = { full: '', ident };
                }
                const provider = new Proivder(this.origin, this.selected.parser);
                provider
                    .load()
                    .then(() => {
                        this.register(
                            provider.subjects.get().error.subscribe(() => {
                                this.checkErrors();
                                this.subjects.get().errorStateChange.emit();
                            }),
                        );
                        this.providers.parser = provider;
                    })
                    .catch((err: Error) => {
                        this.logger.error(`Fail load parser options desc: ${err.message}`);
                    })
                    .finally(() => {
                        this.subjects.get().updated.emit();
                    });
            },
        };
    }

    public isParserIOCompatible(uuid: string): boolean {
        const source = this.sources.find((source) => source.uuid === this.selected.source);
        const parser = this.parsers.find((parser) => parser.uuid === uuid);
        if (!source || !parser) {
            return false;
        }
        return isIOCompatible(source.io, parser.io);
    }

    protected checkErrors() {
        if (!this.providers.parser || !this.providers.source) {
            this.locked = true;
        } else {
            this.locked = !this.providers.parser.isValid() || !this.providers.source.isValid();
        }
    }

    protected checkCompatibility() {
        const source = this.sources.find((source) => source.uuid === this.selected.source);
        if (source === undefined || this.selected.parser === undefined) {
            return;
        }
        const compatible = this.parsers
            .filter((parser) => isIOCompatible(source.io, parser.io))
            .map((parser) => parser.uuid);
        if (compatible.includes(this.selected.parser)) {
            return;
        }
        this.selected.parser = compatible.length === 0 ? undefined : compatible[0];
        this.change().parser();
    }
}

import { SessionAction, Ident, IODataType } from '@platform/types/bindings';
import { components } from '@service/components';
import { Logger } from '@env/logs';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { TabControls } from '@service/session';
import { Proivder } from './provider';
import { SessionOrigin } from '@service/session/origin';

export interface IApi {
    finish(): Promise<void>;
    cancel(): void;
    tab(): TabControls;
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
    public locked: boolean = false;

    protected readonly logger = new Logger(`Setup`);

    constructor(protected readonly origin: SessionOrigin) {
        super();
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
    public load() {
        components
            .get(this.origin.getDef())
            .sources()
            .then((sources: Ident[]) => {
                this.sources = sources;
                if (this.sources.length > 0) {
                    this.selected.source = this.sources[0].uuid;
                }
                this.subjects.get().sources.emit(this.sources);
                this.change().source();
            })
            .catch((err: Error) => {
                this.logger.error(`Fail to get sources list: ${err.message}`);
                this.subjects.get().error.emit(err.message);
            });
        components
            .get(this.origin.getDef())
            .parsers()
            .then((parsers: Ident[]) => {
                this.parsers = parsers;
                if (this.parsers.length > 0) {
                    this.selected.parser = this.parsers[0].uuid;
                }
                this.subjects.get().parsers.emit(this.parsers);
                this.change().parser();
            })
            .catch((err: Error) => {
                this.logger.error(`Fail to get parsers list: ${err.message}`);
                this.subjects.get().error.emit(err.message);
            });
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

function isIOCompatible(a: IODataType, b: IODataType): boolean {
    if (a === 'Any' || b === 'Any') {
        return true;
    }
    if (typeof a === 'string' && typeof b === 'string') {
        return a == b;
    }
    const aMtl:
        | {
              Multiple: Array<IODataType>;
          }
        | undefined =
        typeof a === 'object'
            ? (a as {
                  Multiple: Array<IODataType>;
              })
            : undefined;
    const bMtl:
        | {
              Multiple: Array<IODataType>;
          }
        | undefined =
        typeof b === 'object'
            ? (b as {
                  Multiple: Array<IODataType>;
              })
            : undefined;
    if (aMtl && bMtl) {
        return aMtl.Multiple.find((a) => bMtl.Multiple.includes(a)) !== undefined;
    } else if (aMtl) {
        return aMtl.Multiple.includes(b);
    } else if (bMtl) {
        return bMtl.Multiple.includes(a);
    } else {
        return false;
    }
}

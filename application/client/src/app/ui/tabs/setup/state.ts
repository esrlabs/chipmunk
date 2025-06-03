import { SessionAction, Ident } from '@platform/types/bindings';
import { components } from '@service/components';
import { Logger } from '@env/logs';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { TabControls } from '@service/session';
import { Proivder } from './provider';
import { SessionSourceOrigin } from '@service/session/origin';

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
        updated: Subject<void>;
    }> = new Subjects({
        sources: new Subject(),
        parsers: new Subject(),
        error: new Subject(),
        updated: new Subject(),
    });
    public selected: {
        source: string;
        parser: string;
    } = {
        source: '',
        parser: '',
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

    protected readonly logger = new Logger(`Setup`);

    constructor(protected readonly origin: SessionSourceOrigin) {
        super();
    }
    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
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
                this.subjects.get().parsers.emit(this.sources);
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
                this.description.source = undefined;
                const ident = this.sources.find((ident) => ident.uuid == this.selected.source);
                if (ident !== undefined) {
                    this.description.source = { full: '', ident };
                }
                this.providers.source = new Proivder(this.origin, this.selected.source);
                this.subjects.get().updated.emit();
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
                const ident = this.parsers.find((ident) => ident.uuid == this.selected.parser);
                if (ident !== undefined) {
                    this.description.parser = { full: '', ident };
                }
                this.providers.parser = new Proivder(this.origin, this.selected.parser);
                this.subjects.get().updated.emit();
            },
        };
    }
}

import { SourceOrigin, Ident } from '@platform/types/bindings';
import { components } from '@service/components';
import { Logger } from '@env/logs';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { TabControls } from '@service/session';
import { Proivder } from './provider';

export interface IApi {
    finish(): Promise<void>;
    cancel(): void;
    tab(): TabControls;
}

export class State extends Subscriber {
    public origin: SourceOrigin = 'Source';
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
    public providers: {
        source: Proivder | undefined;
        parser: Proivder | undefined;
    } = {
        source: undefined,
        parser: undefined,
    };

    protected readonly logger = new Logger(`Setup`);

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }
    public load() {
        components
            .get(this.origin)
            .sources()
            .then((sources: Ident[]) => {
                this.sources = sources;
                this.subjects.get().sources.emit(this.sources);
            })
            .catch((err: Error) => {
                this.logger.error(`Fail to get sources list: ${err.message}`);
                this.subjects.get().error.emit(err.message);
            });
        components
            .get(this.origin)
            .parsers()
            .then((parsers: Ident[]) => {
                this.parsers = parsers;
                this.subjects.get().parsers.emit(this.sources);
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
                if (this.providers.source !== undefined) {
                    this.providers.source.destroy().catch((err: Error) => {
                        this.logger.error(`Fail to destroy source provider: ${err.message}`);
                    });
                }
                this.providers.source = new Proivder(this.origin, this.selected.source);
                this.subjects.get().updated.emit();
            },
            parser: (): void => {
                if (this.providers.parser !== undefined) {
                    this.providers.parser.destroy().catch((err: Error) => {
                        this.logger.error(`Fail to destroy parser provider: ${err.message}`);
                    });
                }
                this.providers.parser = new Proivder(this.origin, this.selected.parser);
                this.subjects.get().updated.emit();
            },
        };
    }
}

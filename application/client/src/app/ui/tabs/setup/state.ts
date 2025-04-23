import { SourceOrigin, Ident } from '@platform/types/bindings';
import { components } from '@service/components';
import { Logger } from '@env/logs';
import { Subscriber, Subject, Subjects } from '@platform/env/subscription';
import { TabControls } from '@service/session';

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
    }> = new Subjects({
        sources: new Subject(),
        parsers: new Subject(),
        error: new Subject(),
    });
    public selected: {
        source: string;
        parser: string;
    } = {
        source: '',
        parser: '',
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
        stream(): void;
        parser(): void;
    } {
        return {
            stream: (): void => {},
            parser: (): void => {},
        };
    }
}

import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Logger } from '@platform/log';
import { Session } from '@service/session/session';
import { ObserveSource } from '@service/session/dependencies/observing/source';
import { unique } from '@platform/env/sequence';
import { Subject, Subjects } from '@platform/env/subscription';
import { IMenuItem } from '@ui/service/contextmenu';
import { opener } from '@service/opener';
import { DataSource, SourcesFactory, ParserName, Origin } from '@platform/types/observe';

export interface ProviderConstructor {
    new (session: Session, logger: Logger): Provider;
}

export abstract class Provider {
    public readonly session: Session;
    public readonly logger: Logger;
    public readonly subjects: Subjects<{
        updated: Subject<void>;
    }> = new Subjects({
        updated: new Subject<void>(),
    });
    public panels!: {
        list: {
            name: string;
            desc: string;
            comp: IComponentDesc;
        };
        details: {
            name: string | undefined;
            desc: string | undefined;
            comp: IComponentDesc | undefined;
        };
        nocontent: {
            name: string | undefined;
            desc: string | undefined;
            comp: IComponentDesc | undefined;
        };
    };
    public readonly uuid: string = unique();

    constructor(session: Session, logger: Logger) {
        this.session = session;
        this.logger = logger;
    }

    public destroy() {
        this.subjects.destroy();
    }

    public get(): {
        parser(): ParserName | Error;
        origin(): Origin | Error;
    } {
        const sources = this.sources();
        const last = sources.length > 0 ? sources[sources.length - 1] : undefined;
        return {
            parser: (): ParserName | Error => {
                if (last === undefined) {
                    return new Error(`Provider doesn't have previous sources. Fail to repeat.`);
                }
                return last.source.getParserName();
            },
            origin: (): Origin | Error => {
                if (last === undefined) {
                    return new Error(`Provider doesn't have previous sources. Fail to repeat.`);
                }
                return last.source.getOrigin();
            },
        };
    }

    public repeat(source: DataSource): Promise<void> {
        const sourceDef = source.asSourceDefinition();
        if (sourceDef instanceof Error) {
            return Promise.reject(
                new Error(
                    this.logger.error(`Fail to get process definition: ${sourceDef.message}`),
                ),
            );
        }
        return this.session.stream
            .connect(sourceDef)
            .source(source)
            .catch((err: Error) => {
                this.logger.error(`Fail to restart process: ${err.message}`);
            });
    }

    public clone(factory: SourcesFactory): Promise<void> {
        const sources = this.sources();
        if (sources.length === 0) {
            return Promise.reject(
                new Error(`Provider doesn't have previous sources. Fail to repeat.`),
            );
        }
        const previous = sources[sources.length - 1];
        const source = (() => {
            if (previous.source.parser.Dlt !== undefined) {
                return factory.dlt(previous.source.parser.Dlt);
            } else if (previous.source.parser.SomeIp !== undefined) {
                throw new Error(`Ins't supported yet`);
            } else {
                return factory.text();
            }
        })();
        const sourceDef = source.asSourceDefinition();
        if (sourceDef instanceof Error) {
            return Promise.reject(
                new Error(
                    this.logger.error(`Fail to get process definition: ${sourceDef.message}`),
                ),
            );
        }
        return this.session.stream
            .connect(sourceDef)
            .source(source)
            .catch((err: Error) => {
                this.logger.error(`Fail to restart process: ${err.message}`);
            });
    }

    public openAsNew(source: ObserveSource | DataSource): Promise<string> {
        return opener.from(source instanceof ObserveSource ? source.source : source);
    }

    public setPanels(): Provider {
        this.panels = {
            list: {
                name: this.getPanels().list().name(),
                desc: this.getPanels().list().desc(),
                comp: this.getPanels().list().comp(),
            },
            details: {
                name: this.getPanels().details().name(),
                desc: this.getPanels().details().desc(),
                comp: this.getPanels().details().comp(),
            },
            nocontent: {
                name: this.getPanels().nocontent().name(),
                desc: this.getPanels().nocontent().desc(),
                comp: this.getPanels().nocontent().comp(),
            },
        };
        return this;
    }

    public isEmpty(): boolean {
        return this.sources().length === 0;
    }

    public abstract contextMenu(source: ObserveSource): IMenuItem[];

    public abstract update(sources: ObserveSource[]): Provider;

    public abstract sources(): ObserveSource[];

    public abstract getPanels(): {
        list(): {
            name(): string;
            desc(): string;
            comp(): IComponentDesc;
        };
        details(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
        };
        nocontent(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
        };
    };

    public getNewSourceError(): Error | undefined {
        return undefined;
    }

    public count(): number {
        return this.sources().length;
    }
}

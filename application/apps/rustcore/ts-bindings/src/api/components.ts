import { Logger } from 'platform/log';
import { scope } from 'platform/env/scope';
import { v4 as uuid } from 'uuid';
import { Base as Native } from '../native/native.components';
import { ComponentsEventProvider, IComponentsEvents } from '../api/components.provider';
import { SessionStream } from '../api/session.stream';
import { SessionSearch } from '../api/session.search';
import { Subscriber } from 'platform/env/subscription';
import { ComponentsOptionsList, Ident, SourceOrigin } from 'platform/types/bindings';

export {
    ISessionEvents,
    IProgressEvent,
    IProgressState,
    IEventMapUpdated,
    IEventMatchesUpdated,
    IEventIndexedMapUpdated,
} from '../api/session.provider';
export { ComponentsEventProvider, SessionStream, SessionSearch };

export * as $ from 'platform/types/observe';
export * as Factory from 'platform/types/observe/factory';

export class Components extends Subscriber {
    private readonly native: Native;
    private readonly provider: ComponentsEventProvider;
    private readonly logger: Logger;
    private readonly uuid: string = uuid();

    constructor(resolver: (err: Error | undefined) => void) {
        super();
        this.logger = scope.getLogger(`Components: ${this.uuid}`);
        this.provider = new ComponentsEventProvider(this.uuid);
        this.native = new Native(this.provider, (err: Error | undefined) => {
            if (err instanceof Error) {
                this.logger.error(`Fail to create a components session: ${err.message}`);
            }
            resolver(err);
        });
    }

    static create(): Promise<Components> {
        return new Promise((resolve, reject) => {
            const components = new Components((err: Error | undefined) => {
                if (err instanceof Error) {
                    reject(err);
                } else {
                    resolve(components);
                }
            });
        });
    }

    public destroy(): Promise<void> {
        return this.native.destroy().catch((err: Error) => {
            this.logger.error(`Fail to destroy session: ${err.message}`);
            return Promise.reject(err);
        });
    }

    public getEvents(): IComponentsEvents {
        if (this.provider === undefined) {
            throw new Error(`EventProvider wasn't created`);
        }
        return this.provider.getEvents();
    }

    public get(origin: SourceOrigin): {
        sources(): Promise<Ident[]>;
        parsers(): Promise<Ident[]>;
    } {
        return {
            sources: (): Promise<Ident[]> => {
                return this.native.getComponents(origin, 'Source');
            },
            parsers: (): Promise<Ident[]> => {
                return this.native.getComponents(origin, 'Parser');
            },
        };
    }

    public getOptions(origin: SourceOrigin, targets: string[]): Promise<ComponentsOptionsList> {
        return this.native.getOptions(origin, targets);
    }

    public abort(fields: string[]): Error | undefined {
        return this.native.abort(fields);
    }
}

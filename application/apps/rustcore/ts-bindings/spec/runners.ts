import {
    Jobs,
    Tracker,
    Session,
    SessionStream,
    ISessionEvents,
    SessionSearch,
    Components,
} from '../src/index';
import { Logger, getLogger } from './logger';
import { error } from 'platform/log/utils';
import { IRegularTests } from './config';
import { IPerformanceTest } from './config_benchmarks';
import { finish } from './common';

export interface SessionComponents {
    session: Session;
    stream: SessionStream;
    events: ISessionEvents;
    search: SessionSearch;
}

export async function initializeSession(testName: string): Promise<SessionComponents> {
    const session = await Session.create();
    session.debug(true, testName);

    let stream, events, search;

    stream = session.getStream();
    if (stream instanceof Error) throw stream;

    events = session.getEvents();
    if (events instanceof Error) throw events;

    search = session.getSearch();
    if (search instanceof Error) throw search;

    return { session, stream, events, search };
}

export type ScopeInjector<T> = (s: T) => T;

function validate(
    config: IRegularTests | IPerformanceTest,
    id: string | number,
): string | Promise<void> {
    let name: string;
    let shouldExecute = true;
    if ('list' in config) {
        // Handling IRegularTests
        name = config.list[id];
        shouldExecute =
            config.execute_only.length === 0 ||
            config.execute_only.includes(typeof id === 'number' ? id : parseInt(id, 10));
    } else if ('alias' in config) {
        // Handling IPerformanceTest
        name = config.alias;
        shouldExecute = !config.ignore;
    } else {
        // Log the type of config received
        console.error('Invalid configuration passed to runner. Config:', config);
        return Promise.reject(new Error('Invalid configuration passed to runner'));
    }
    if (!shouldExecute) {
        console.log(`\nIgnored: ${name}`);
        return Promise.resolve(void 0);
    } else {
        console.log(`\nStarted: ${name}`);
    }
    return name;
}

export async function withSession(
    config: IRegularTests | IPerformanceTest,
    id: string | number,
    test: (logger: Logger, done: () => void, components: SessionComponents) => Promise<void>,
): Promise<void> {
    const name = validate(config, id);
    if (typeof name !== 'string') {
        return name;
    }
    const logger = getLogger(name);
    return new Promise((done) => {
        initializeSession(name)
            .then((components) => {
                const sessionRef = components.session;
                try {
                    test(logger, done, components).catch((err: Error) => {
                        finish(sessionRef, done, err);
                    });
                } catch (err) {
                    finish(sessionRef, done, new Error(error(err)));
                }
            })
            .catch((err: Error) => {
                logger.error(`Fail to init session due: ${err.message}`);
                finish(undefined, done, new Error(error(err)));
            });
    });
}

export async function noSession(
    config: IRegularTests | IPerformanceTest,
    id: string | number,
    test: (logger: Logger, done: () => void) => Promise<void>,
): Promise<void> {
    const name = validate(config, id);
    if (typeof name !== 'string') {
        return name;
    }
    const logger = getLogger(name);
    return new Promise((done) => {
        try {
            test(logger, done).catch((err: Error) => {
                finish(undefined, done, err);
            });
        } catch (err) {
            finish(undefined, done, new Error(error(err)));
        }
    });
}

export function unbound(
    config: IRegularTests | IPerformanceTest,
    id: string | number,
    test: (
        logger: Logger,
        done: () => void,
        add: ScopeInjector<Session | Tracker | Jobs | Components>,
    ) => Promise<void>,
): Promise<void> {
    const scope: Array<Session | Tracker | Jobs | Components> = [];
    const injector: ScopeInjector<Session | Tracker | Jobs | Components> = (
        obj: Session | Tracker | Jobs | Components,
    ) => {
        scope.push(obj);
        return obj;
    };
    const name = validate(config, id);
    if (typeof name !== 'string') {
        return name;
    }
    const logger = getLogger(name);
    return new Promise((done) => {
        try {
            test(logger, done, injector).catch((err: Error) => {
                finish(scope, done, err);
            });
        } catch (err) {
            finish(scope, done, new Error(error(err)));
        }
    });
}

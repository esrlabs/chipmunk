import { bridge } from '@service/bridge';
import { scope } from '@platform/env/scope';
import { Subject } from '@platform/env/subscription';
import { error } from '@platform/log/utils';
import { Destroy } from '@platform/types/env/types';
import { Action } from '../../../../../action';

import * as Errors from '../bases/serial/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

const SERIAL_PORT_SETTINGS_STORAGE = 'serial_port_settings';
const REGULAR_RESCAN_PORTS_DURATION_MS = 3000;
const NOPORTS_RESCAN_PORTS_DURATION_MS = 1000;

const CUSTOM_BAUD_RATE_REF = 'Custom';
const BAUD_RATE = [
    CUSTOM_BAUD_RATE_REF,
    50,
    75,
    110,
    134,
    150,
    200,
    300,
    600,
    1200,
    1800,
    2400,
    4800,
    9600,
    19200,
    38400,
    57600,
    115200,
    230400,
    460800,
    500000,
    576000,
    921600,
    1000000,
    1152000,
    1500000,
    2000000,
    2500000,
    3000000,
    3500000,
    4000000,
];
const DATA_BITS: number[] = [8, 7, 6, 5];
const FLOW_CONTROL = [
    { value: 0, name: 'None' },
    { value: 1, name: 'Hardware' },
    { value: 2, name: 'Software' },
];
const PARITY = [
    { value: 0, name: 'None' },
    { value: 1, name: 'Odd' },
    { value: 2, name: 'Even' },
];
const STOP_BITS = [1, 2];

export class State implements Destroy {
    public errors: {
        baudRate: Errors.ErrorState;
    };

    public ports: string[] = [];
    public changed: Subject<void> = new Subject<void>();
    public baudRateProxy: number | string = 9600;

    public BAUD_RATE = BAUD_RATE;
    public DATA_BITS = DATA_BITS;
    public FLOW_CONTROL = FLOW_CONTROL;
    public PARITY = PARITY;
    public STOP_BITS = STOP_BITS;

    protected timer: number = -1;
    protected states: Map<string, Stream.Serial.IConfiguration> = new Map();
    protected prev: string = '';

    constructor(
        public readonly action: Action,
        public readonly configuration: Stream.Serial.Configuration,
    ) {
        this.errors = {
            baudRate: new Errors.ErrorState(Errors.Field.baudRate, () => {
                // this.update();
            }),
        };
        this.history().load();
    }

    public destroy(): void {
        // Having method "destroy()" is requirement of session's storage
    }

    public scan(): {
        start(): void;
        stop(): void;
    } {
        const logger = scope.getLogger('SerialPorts Scanner');
        return {
            start: (): void => {
                function isSame(prev: string[], current: string[]): boolean {
                    return prev.join(';') === current.join(';');
                }
                this.scan().stop();
                bridge
                    .ports()
                    .list()
                    .then((ports: string[]) => {
                        if (isSame(this.ports, ports)) {
                            return;
                        }
                        this.ports = ports;
                        if (this.ports.includes(this.configuration.configuration.path)) {
                            return;
                        }
                        this.configuration.configuration.path =
                            this.ports[0] === undefined ? '' : this.ports[0];
                        this.configuration.configuration.path !== '' &&
                            this.history().restore(this.configuration.configuration.path);
                        this.prev = this.configuration.configuration.path;
                        this.changed.emit();
                    })
                    .catch((err: Error) => {
                        logger.error(`Fail to update ports list due error: ${err.message}`);
                    })
                    .finally(() => {
                        this.timer = setTimeout(
                            () => {
                                this.scan().start();
                            },
                            this.ports.length === 0
                                ? NOPORTS_RESCAN_PORTS_DURATION_MS
                                : REGULAR_RESCAN_PORTS_DURATION_MS,
                        ) as unknown as number;
                    });
            },
            stop: (): void => {
                clearTimeout(this.timer);
            },
        };
    }

    public isEmpty(): boolean {
        return this.ports.length === 0;
    }

    public history(): {
        update(path: string): void;
        restore(path: string): void;
        load(): void;
        save(): void;
    } {
        const logger = scope.getLogger('SerialPorts Settings History');
        return {
            update: (path: string): void => {
                if (this.prev !== '') {
                    this.states.set(this.prev, this.configuration.configuration);
                }
                this.history().restore(path);
                this.prev = path;
                this.history().save();
                this.changed.emit();
            },
            restore: (path: string): void => {
                const state = this.states.get(path);
                this.configuration.overwrite(
                    state === undefined ? Stream.Serial.Configuration.initial() : state,
                );
                this.baudRateProxtUpdate();
                this.configuration.configuration.path = path;
            },
            load: (): void => {
                bridge
                    .storage(SERIAL_PORT_SETTINGS_STORAGE)
                    .read()
                    .then((content: string) => {
                        if (content === '') {
                            return;
                        }
                        try {
                            const map = JSON.parse(content);
                            if (!(map instanceof Array)) {
                                logger.warn(`Invalid format of history`);
                                return;
                            }
                            this.states.clear();
                            map.forEach((pair) => {
                                if (pair instanceof Array && pair.length === 2) {
                                    this.states.set(pair[0], pair[1]);
                                }
                            });
                            this.configuration.configuration.path !== '' &&
                                this.history().restore(this.configuration.configuration.path);
                        } catch (e) {
                            logger.warn(`Fail to parse history: ${error(e)}`);
                        }
                    })
                    .catch((err: Error) => {
                        logger.warn(`Fail to get history: ${err.message}`);
                    });
            },
            save: (): void => {
                const map: [string, Stream.Serial.IConfiguration][] = [];
                this.states.forEach((value, key) => {
                    map.push([key, value]);
                });
                bridge
                    .storage(SERIAL_PORT_SETTINGS_STORAGE)
                    .write(JSON.stringify(map))
                    .catch((err: Error) => {
                        logger.warn(`Fail to save history: ${err.message}`);
                    });
            },
        };
    }

    public isBoudRateCustom(): boolean {
        return this.baudRateProxy === CUSTOM_BAUD_RATE_REF;
    }

    public baudRateChange(): void {
        this.configuration.configuration.baud_rate =
            typeof this.baudRateProxy === 'string'
                ? this.configuration.configuration.baud_rate
                : this.baudRateProxy;
        this.configuration.configuration.baud_rate =
            typeof this.configuration.configuration.baud_rate === 'string'
                ? parseInt(this.configuration.configuration.baud_rate, 10)
                : this.configuration.configuration.baud_rate;
        if (
            isNaN(this.configuration.configuration.baud_rate) ||
            !isFinite(this.configuration.configuration.baud_rate)
        ) {
            this.configuration.configuration.baud_rate =
                Stream.Serial.Configuration.initial().baud_rate;
        }
        this.changed.emit();
    }

    public defaluts(): void {
        const path = this.configuration.configuration.path;
        this.configuration.overwrite(Stream.Serial.Configuration.initial());
        this.configuration.configuration.path = path;
        this.states.set(this.configuration.configuration.path, this.configuration.configuration);
        this.baudRateProxtUpdate();
        this.history().save();
        this.changed.emit();
    }

    protected baudRateProxtUpdate(): void {
        if (
            this.BAUD_RATE.find((r) => r == this.configuration.configuration.baud_rate) ===
            undefined
        ) {
            this.baudRateProxy = CUSTOM_BAUD_RATE_REF;
        } else {
            this.baudRateProxy = this.configuration.configuration.baud_rate;
        }
    }
}

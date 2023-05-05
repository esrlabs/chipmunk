import { SerialTransportSettings } from '@platform/types/transport/serial';
import { Base } from './state';
import { bridge } from '@service/bridge';
import { scope } from '@platform/env/scope';
import { Subject } from '@platform/env/subscription';
import * as Errors from '../bases/serial/error';

const REGULAR_RESCAN_PORTS_DURATION_MS = 3000;
const NOPORTS_RESCAN_PORTS_DURATION_MS = 1000;

const DEFAULTS: SerialTransportSettings = {
    baud_rate: 9600,
    data_bits: 8,
    flow_control: 0,
    parity: 0,
    path: '',
    stop_bits: 1,
};
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

export class State extends Base<SerialTransportSettings> {
    public errors: {
        baudRate: Errors.ErrorState;
    };
    public baudRate: number = 9600;
    public dataBits: number = 8;
    public flowControl: number = 0;
    public parity: number = 0;
    public path: string = '';
    public stopBits: number = 1;
    public baudRateProxy: number | string = 9600;

    public ports: string[] = [];
    public changed: Subject<void> = new Subject<void>();

    public BAUD_RATE = BAUD_RATE;
    public DATA_BITS = DATA_BITS;
    public FLOW_CONTROL = FLOW_CONTROL;
    public PARITY = PARITY;
    public STOP_BITS = STOP_BITS;

    protected timer: number = -1;
    protected states: Map<string, SerialTransportSettings> = new Map();
    protected prev: string = '';

    constructor() {
        super();
        this.errors = {
            baudRate: new Errors.ErrorState(Errors.Field.baudRate, () => {
                this.update();
            }),
        };
    }

    public from(opt: SerialTransportSettings) {
        this.baudRate = opt.baud_rate;
        this.dataBits = opt.data_bits;
        this.flowControl = opt.flow_control;
        this.parity = opt.parity;
        this.path = opt.path;
        this.stopBits = opt.stop_bits;
    }

    public asSourceDefinition(): SerialTransportSettings {
        return {
            baud_rate: this.baudRate,
            data_bits: this.dataBits,
            flow_control: this.flowControl,
            parity: this.parity,
            path: this.path,
            stop_bits: this.stopBits,
        };
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
                        if (this.ports.includes(this.path)) {
                            return;
                        }
                        this.path = this.ports[0] === undefined ? '' : this.ports[0];
                        this.prev = this.path;
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
    } {
        return {
            update: (path: string): void => {
                if (this.prev !== '') {
                    this.states.set(this.prev, this.asSourceDefinition());
                }
                const state = this.states.get(path);
                if (state === undefined) {
                    this.from(DEFAULTS);
                } else {
                    this.from(state);
                }
                this.baudRateProxtUpdate();
                this.path = path;
                this.prev = path;
                this.changed.emit();
            },
        };
    }

    public isBoudRateCustom(): boolean {
        return this.baudRateProxy === CUSTOM_BAUD_RATE_REF;
    }

    public baudRateChange(): void {
        this.baudRate = typeof this.baudRateProxy === 'string' ? this.baudRate : this.baudRateProxy;
        this.baudRate =
            typeof this.baudRate === 'string' ? parseInt(this.baudRate, 10) : this.baudRate;
        this.changed.emit();
    }

    public defaluts(): void {
        const path = this.path;
        this.from(DEFAULTS);
        this.path = path;
        this.states.set(this.path, this.asSourceDefinition());
        this.baudRateProxtUpdate();
        this.changed.emit();
    }

    protected baudRateProxtUpdate(): void {
        if (this.BAUD_RATE.find((r) => r == this.baudRate) === undefined) {
            this.baudRateProxy = CUSTOM_BAUD_RATE_REF;
        } else {
            this.baudRateProxy = this.baudRate;
        }
    }
}

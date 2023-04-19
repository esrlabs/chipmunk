export const NO_PORT: string = '<No port selected>';

export const CUSTOM_PORT: string = '<Custom port>';

export const BAUD_RATE: number[] = [
    50, 75, 110, 134, 150, 200, 300, 600, 1200, 1800, 2400, 4800, 9600, 19200, 38400, 57600, 115200,
    230400, 460800, 500000, 576000, 921600, 1000000, 1152000, 1500000, 2000000, 2500000, 3000000,
    3500000, 4000000,
];

export const CUSTOM_BAUD_RATE: { name: string; value: number } = {
    name: '<Custom baudrate>',
    value: -1,
};

export const DATA_BITS: number[] = [5, 6, 7, 8];

export const FLOW_CONTROL: {
    value: number;
    name: string;
}[] = [
    { value: 0, name: 'None' },
    { value: 1, name: 'Hardware' },
    { value: 2, name: 'Software' },
];

export const PARITY = [
    { value: 0, name: 'None' },
    { value: 1, name: 'Odd' },
    { value: 2, name: 'Even' },
];

export const STOP_BITS: number[] = [1, 2];

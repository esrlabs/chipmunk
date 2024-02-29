export enum ChartType {
    Linear = 'Linear',
    Stepper = 'Stepper',
    Temperature = 'Temperature',
}

export interface ChartDefinition {
    filter: string;
    color: string;
    widths: {
        line: number;
        point: number;
    };
    active: boolean;
    type: ChartType;
    uuid: string;
}

export enum EntityTypeRef {
    chart = 'chart',
    filter = 'filter',
    range = 'range',
}

export interface DisableConvertable {
    disabled(): {
        displayName(): string;
        typeRef(): EntityTypeRef;
        icon(): string;
    };
}

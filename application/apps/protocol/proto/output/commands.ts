export interface OutputOneof {
    StringValue?: string;
    StringVecValue?: StringVec;
    OptionStringValue?: string;
    BoolValue?: boolean;
    Int64Value?: number;
    EmptyValue?: Empty;
}
export interface OutcomeOneof {
    Finished?: Finished;
    Cancelled?: Cancelled;
}
export interface Cancelled {
}
export interface Empty {
}
export interface Finished {
    result: Output | null;
}
export interface Output {
    output_oneof: OutputOneof | null;
}
export interface StringVec {
    values: string[];
}
export interface CommandOutcome {
    outcome_oneof: OutcomeOneof | null;
}

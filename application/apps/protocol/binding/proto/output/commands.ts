export interface Cancelled {
}
export interface OutputOneof {
    StringValue?: string;
    StringVecValue?: StringVec;
    OptionStringValue?: string;
    BoolValue?: boolean;
    Int64Value?: number;
    EmptyValue?: Empty;
}
export interface Output {
    output_oneof: OutputOneof | null;
}
export interface Empty {
}
export interface OutcomeOneof {
    Finished?: Finished;
    Cancelled?: Cancelled;
}
export interface StringVec {
    values: string[];
}
export interface Finished {
    result: Output | null;
}
export interface CommandOutcome {
    outcome_oneof: OutcomeOneof | null;
}

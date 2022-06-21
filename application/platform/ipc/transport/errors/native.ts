import * as obj from '../../../env/obj';

export class RustNativeError {
    static PROP_NAME = 'NativeError';
    public static from(str: string): RustNativeError | undefined {
        try {
            const smth: { [key: string]: Record<string, unknown> } = JSON.parse(str);
            if (smth[RustNativeError.PROP_NAME] === undefined) {
                return undefined;
            }
            return new RustNativeError(
                obj.getAsNotEmptyString(smth[RustNativeError.PROP_NAME], 'kind'),
                obj.getAsString(smth[RustNativeError.PROP_NAME], 'message'),
                obj.getAsNotEmptyString(smth[RustNativeError.PROP_NAME], 'severity'),
            );
        } catch (_) {
            return undefined;
        }
    }
    public kind: string;
    public message: string;
    public severity: string;

    constructor(kind: string, message: string, severity: string) {
        this.kind = kind;
        this.message = message;
        this.severity = severity;
    }
}

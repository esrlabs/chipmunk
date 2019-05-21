/**
 * @class
 * Settings object validator
 *
 * @property {boolean} throwOnError         - Throw exeption on validation error
 * @property {boolean} recursive            - Check types nested objects also
 * @property {boolean} replaceIfMissed      - Replace value by default if missed on target object
 * @property {boolean} replaceIfWrongType   - Replace value by default if target object value has wrong type
 */
export class ObjectValidateParameters {

    public throwOnError: boolean;
    public recursive: boolean;
    public replaceIfMissed: boolean;
    public replaceIfWrongType: boolean;

    constructor(
        {  throwOnError = true,
            recursive = true,
            replaceIfMissed = true,
            replaceIfWrongType = true,
        }: {
            throwOnError?: boolean,
            recursive?: boolean,
            replaceIfMissed?: boolean,
            replaceIfWrongType?: boolean,
        }) {
        this.throwOnError = throwOnError;
        this.recursive = recursive;
        this.replaceIfMissed = replaceIfMissed;
        this.replaceIfWrongType = replaceIfWrongType;
    }
}

export default function validate(obj: any, defaults: any, params?: ObjectValidateParameters) {

    const parameters = params instanceof ObjectValidateParameters ? params : (new ObjectValidateParameters({}));

    let error: Error | null = null;

    if (typeof obj !== 'object' || obj === null) {
        error = new Error('Property [obj] expected to be [object].');
        if (parameters.throwOnError) {
            throw error;
        }
        return error;
    }

    if (typeof defaults !== 'object' || defaults === null) {
        error = new Error('Property [defaults] expected to be [object].');
        if (parameters.throwOnError) {
            throw error;
        }
        return error;
    }

    const objectValidator = (target: any, defaultsValues: any) => {
        Object.keys(defaultsValues).forEach((key) => {
            if (error !== null) {
                return false;
            }
            if (target[key] === void 0) {
                if (parameters.replaceIfMissed) {
                    target[key] = defaultsValues[key];
                } else {
                    error = new Error(`key [${key}] isn't found in target object.`);
                }
            } else if (target[key] !== void 0 && typeof defaultsValues[key] !== 'undefined' && typeof defaultsValues[key] !== typeof target[key]) {
                if (parameters.replaceIfWrongType) {
                    target[key] = defaultsValues[key];
                } else {
                    error = new Error(`key [${key}] has type <${(typeof target[key])}>, but expected: <${(typeof defaultsValues[key])}>.`);
                }
            } else if (defaultsValues[key] === null) {
                // Nothing to do
            } else if (defaultsValues[key] instanceof Array) {
                arrayValidator(target[key], defaultsValues[key], key);
            } else if (typeof defaultsValues[key] === 'object') {
                objectValidator(target[key], defaultsValues[key]);
            }
        });
    };

    const arrayValidator = (target: any[], defaultsValues: any[], key: string) => {
        // Expecting that defaults[key][0] is a pattern of items in an array
        if (defaultsValues.length !== 0) {
            error = new Error(`key [${key}] should have only one item, which is a pattern for validation target array in object.`);
            return false;
        }

        const itemPattern = defaultsValues[0];

        target.forEach((item, index) => {
            if (typeof item !== typeof itemPattern) {
                if (parameters.replaceIfWrongType) {
                    target[index] = itemPattern;
                } else {
                    error = new Error(`key [${key}], array item #${index} has not expected type <${(typeof item)}>, but expected <${(typeof itemPattern)}>.`);
                }
            } else if (itemPattern instanceof Array) {
                arrayValidator(item, itemPattern, key);
            } else if (typeof itemPattern === 'object' && itemPattern !== null) {
                validate(item, itemPattern);
            }
        });
    };

    objectValidator(obj, defaults);

    if (error !== null && parameters.throwOnError) {
        throw error;
    }
    return error !== null ? error : obj;

}

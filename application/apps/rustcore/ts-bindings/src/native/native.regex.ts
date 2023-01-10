import { getNativeModule } from './native';
import { IFilter } from '../interfaces/index';

export function getFilterError(filter: IFilter): Error | undefined {
    const ModRef = getNativeModule();
    const error = ModRef.getFilterError({
        value: filter.filter,
        is_regex: filter.flags.reg,
        ignore_case: !filter.flags.cases,
        is_word: filter.flags.word,
    });
    if (typeof error === 'string' && error.trim() !== '') {
        return new Error(error);
    } else {
        return undefined;
    }
}

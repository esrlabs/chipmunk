import * as Types from '../types';

export abstract class StringParser {
    abstract parse(str: string): Types.THTMLString;
}
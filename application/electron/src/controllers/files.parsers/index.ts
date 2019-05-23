import FileParserText from './file.parser.text';
import FileParserDlt from './file.parser.dlt';
import { AFileParser, IFileParserFunc } from './interface';

export interface IFileParser {
    name: string;
    alias: string;
    desc: string;
    class: any;
}
const FileParsers: IFileParser[] = [
    {
        name: 'Text',
        alias: 'text',
        desc: 'Parser for text files (utf8, ascii)',
        class: FileParserText,
    },
    {
        name: 'DLT',
        alias: 'dlt',
        desc: 'Parser for DLT files',
        class: FileParserDlt,
    },
];

export { FileParsers, AFileParser, IFileParserFunc };

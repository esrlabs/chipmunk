import FileParserText from './file.parser.text';
import FileParserDlt from './file.parser.dlt';

export interface IFileParser {
    name: string;
    desc: string;
    class: any;
}
const FileParsers: IFileParser[] = [
    {
        name: 'Text',
        desc: 'Parser for text files (utf8, ascii)',
        class: FileParserText,
    },
    {
        name: 'DLT',
        desc: 'Parser for DLT files',
        class: FileParserDlt,
    },
];

export { FileParsers };

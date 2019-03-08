import { AnsiEscapeSequencesColors } from '../tools/ansi.colors';

export function parserRow(str: string): string {
    const colors: AnsiEscapeSequencesColors = new AnsiEscapeSequencesColors();
    return colors.getHTML(str);
}

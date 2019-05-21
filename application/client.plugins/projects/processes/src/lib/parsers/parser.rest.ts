import { AnsiEscapeSequencesColors } from '../tools/ansi.colors';

export function parserRest(str: string): string {
    const colors: AnsiEscapeSequencesColors = new AnsiEscapeSequencesColors();
    return colors.getHTML(str);
}

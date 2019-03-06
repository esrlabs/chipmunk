
const AllCommandsRegExp = /(?<color>\x1b\[[0-9;]*m)|(?<position>\x1b\[\d*;\d*H)|(?<pos>\x1b\[\d*;\d*f)|(?<report>\x1b\[\d*;\d*R)|(?<up>\x1b\[\d*A)|(?<down>\x1b\[\d*B)|(?<right>\x1b\[\d*C)|(?<left>\x1b\[\d*D)|(?<save>\x1b\[s)|(?<return>\x1b\[u)|(?<screen>\x1b\[2J)|(?<clear>\x1b\[K)/;

export enum EAnsiCommands {
    clear = 'clear',
    color = 'color',
    down = 'down',
    left = 'left',
    position = 'position',
    pos = 'pos',
    report = 'report',
    right = 'right',
    save = 'save',
    screen = 'screen',
    up = 'up',
}

export interface IResults {
    command: EAnsiCommands | undefined;
    cleared: string;
    offset: number | undefined;
    values: number[];
}

export function next(input: string): IResults {
    const match = input.match(AllCommandsRegExp);
    if (match === null) {
        return {
            command: undefined,
            cleared: input,
            offset: undefined,
            values: []
        };
    }
    let command: EAnsiCommands | undefined;
    let offset: number | undefined;
    let values: number[] = [];
    Object.keys(match.groups).forEach((key: string) => {
        if (match.groups[key] !== undefined && EAnsiCommands[key]) {
            command = EAnsiCommands[key];
            input = input.replace(match.groups[key], '');
            offset = match.groups[key].length;
            switch (command) {
                case EAnsiCommands.position:
                case EAnsiCommands.report:
                case EAnsiCommands.pos:
                    values = match.groups[key].replace(/[^\d;]/gi, '').split(';').map((val: string) => {
                        return parseInt(val, 10);
                    });
                    break;
                case EAnsiCommands.right:
                case EAnsiCommands.down:
                case EAnsiCommands.up:
                case EAnsiCommands.left:
                    values = [parseInt(match.groups[key].replace(/[^\d]/gi, ''), 10)];
                    break;
                case EAnsiCommands.color:
                    // Ignore colors
                    break;
                case EAnsiCommands.clear:
                case EAnsiCommands.screen:
                case EAnsiCommands.save:
                    // Doesn't have numeric parameters
                    break;
            }
        }
    });
    return {
        command: command,
        cleared: input,
        offset: offset,
        values: values
    };
}



export class DefaultsTelnetSettings {
    host                : string        = '';
    port                : number        = 23;
    timeout             : number        = 30000;
    shellPrompt         : string        = '';
    loginPrompt         : string        = '';
    passwordPrompt      : string        = '';
    failedLoginMatch    : string        = '';
    initialLFCR         : boolean       = false;
    username            : string        = 'root';
    password            : string        = 'guest';
    irs                 : string        = '\r\n';
    ors                 : string        = '\n';
    echoLines           : number        = 1;
    stripShellPrompt    : boolean       = true;
    pageSeparator       : string        = '---- More';
    negotiationMandatory: boolean       = true;
    execTimeout         : number        = 2000;
    sendTimeout         : number        = 2000;
    maxBufferLength     : number        = 1 * 1024 * 1024;
    debug               : boolean       = false;
}


const REGS = {
    CLEAR: /\x1b\[[0-9;]*m/gi,
};

const ANSIClearer = function(str : string){
    return typeof str === 'string' ? str.replace(REGS.CLEAR, '') : '';
};

export { ANSIClearer };

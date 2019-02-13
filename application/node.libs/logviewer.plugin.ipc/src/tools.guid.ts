/**
 * Returns primitive GUID in format XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 * @returns {string} GUID
 */
export default function GUID(base = '') {
    const lengths = [4, 4, 4, 8];
    let result = '';
    for (let i = lengths.length - 1; i >= 0; i -= 1) {
        if (base !== '') {
            if (base.length >= lengths[i]) {
                result += base.substr(0, lengths[i]) + '-';
            } else {
                result += base + (Math.round(Math.random() * Math.random() * Math.pow(10, lengths[i] * 2))
                        .toString(16)
                        .substr(0, lengths[i] - base.length)
                        .toUpperCase() + '-');
            }
            base = base.substr(lengths[i], base.length);
        } else {
            result += (Math.round(Math.random() * Math.random() * Math.pow(10, lengths[i] * 2))
                        .toString(16)
                        .substr(0, lengths[i])
                        .toUpperCase() + '-');
        }
    }
    result += (Math.floor((new Date()).getTime() * (Math.random() * 100)))
                .toString(16)
                .substr(0, 12)
                .toUpperCase();
    return result;
}

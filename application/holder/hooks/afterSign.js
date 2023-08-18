require('dotenv').config();
const {notarize} = require('@electron/notarize');

exports.default = async function notarizing(context) {
    const {electronPlatformName, appOutDir} = context;
    if (electronPlatformName !== 'darwin') {
        return;
    }
    const appName = context.packager.appInfo.productFilename;
    const appleIdPassword = process.env.APPLEIDPASS;
    const appleId = process.env.APPLEID;
    if (appleIdPassword === undefined) {
        console.log('no APPLEIDPASS found => aborting notarize');
        return Promise.resolve();
    }
    if (appleId === undefined) {
        console.log('no APPLEID in envirmonment => aborting notarize');
        return Promise.resolve();
    }

    return await notarize({
        appBundleId: 'com.esrlabs.chipmunk',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLEID,
        appleIdPassword: process.env.APPLEIDPASS,
        teamId: process.env.TEAMID,
        tool: 'notarytool',
    });
};

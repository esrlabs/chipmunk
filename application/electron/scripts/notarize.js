require('dotenv').config();
const {notarize} = require('electron-notarize');

exports.default = async function notarizing(context) {
  const {electronPlatformName, appOutDir} = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }
  let shouldNotarize = process.env.CSC_IDENTITY_AUTO_DISCOVERY;
  if (shouldNotarize === "true") {
    console.log("trying to notarize");

    const appName = context.packager.appInfo.productFilename;
    return await notarize({
      appBundleId: 'com.esrlabs.chipmunk',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS,
    });
  } else {
    console.log("skipping notarize");
  }

};

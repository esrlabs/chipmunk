const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = new (require('../server/libs/tools.logger'))('Electron');
const HOST_URL = 'api.github.com';
const PATH_GET_RELEASES = '/repos/esrlabs/logviewer/releases';
const PATH_GET_LATEST = '/repos/esrlabs/logviewer/releases/latest';

class Connector {
    
    constructor() {
        this.version = null;
        this.canceled = false;
        this.getCurrentVerson();
    }

    getCurrentVerson() {
        let buffer = null;
        try {
            buffer = fs.readFileSync(path.normalize(path.resolve(path.dirname(require.main.filename), 'package.json')));
            if (!(buffer instanceof Buffer)) {
                return logger.error(`Fail to correct read package.json file.`);
            }
            const packageJSON = JSON.parse(buffer.toString('utf8'));
            if (typeof packageJSON.version !== 'string') {
                return logger.error(`Cannot find field "version" in package.json file.`);
            }
            this.version = packageJSON.version;
        } catch (error) {
            logger.error(`Fail to get current version of app due error: ${error.message}`);
        }
    }

    getLastRelease() {
        return new Promise((resolve, reject) => {
            if (this.version === null) {
                return reject(new Error(`Current version of application isn't detected. Please check logs`));
            }
            this.getListOfReleases().then((releases) => {
                let last = null;
                releases.forEach((release) => {
                    if (last !== null) {
                        return;
                    }
                    if (!release.prerelease && !release.draft) {
                        if (release.name > this.version) {
                            last = release;
                        }
                    }
                });
                resolve(last);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    getLatestRelease() {
        return new Promise((resolve, reject) => {
            this.request(HOST_URL, PATH_GET_LATEST).then((output) => {
                const release = this.getJSON(output);
                if (release instanceof Error) {
                    return reject(release);
                }
                if (typeof release !== 'object' || release === null) {
                    return reject(new Error(`Cannot get last release, because expected object, but gotten {${typeof release}}. Github response: ${output}`));
                }
                resolve(release);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    getListOfReleases() {
        return new Promise((resolve, reject) => {
            this.request(HOST_URL, PATH_GET_RELEASES).then((output) => {
                const releases = this.getJSON(output);
                if (releases instanceof Error) {
                    return reject(releases);
                }
                if (!(releases instanceof Array)) {
                    return reject(new Error(`Cannot get releases list, because expected array, but gotten {${typeof releases}}. Github response: ${output}`));
                }
                if (releases.length === 0) {
                    return reject(new Error(`Cannot get releases list, because expected not empty array. Github response: ${output}`));
                }
                resolve(releases);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    getTargetURL(assets, filter) {
        if (!(assets instanceof Array)) {
            return new Error(`Expected assets will be an array, but gotten: ${typeof assets}`);
        }
        if (!(filter instanceof RegExp)){
            return new Error(`Expected filter will be an RegExp, but gotten: ${typeof filter}`);
        }
        let target = null;
        assets.forEach((asset) => {
            if (target !== null) {
                return;
            }
            if (typeof asset !== 'object' || asset === null) {
                return;
            }
            if (typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') {
                return;
            }
            if (asset.name.search(filter) !== -1) {
                target = asset.browser_download_url;
            }
        });
        return target;
    }

    request(host, path) {
        return new Promise((resolve, reject) => {
            const request = https.get({
                host: host,
                path: path,
                headers: {
                    'User-Agent': 'Logviewer Update Checker'
                }
            }, (response) => {
                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                response.on('end', () => {
                    resolve(data);
                });
            }).on("error", (error) => {
                reject(error);
            });
        });
    }

    getLocationURL(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                if (response.statusCode !== 302) {
                    return reject(new Error(`Expecting response code 302, but gotten: ${response.statusCode}`));
                };
                if (typeof response.headers.location !== 'string' || response.headers.location.trim() === '') {
                    return reject(new Error(`Expecting string value in [headers.location], but gotten: ${typeof response.headers.location}`));
                }
                resolve(response.headers.location.trim());
            }).on("error", (error) => {
                reject(error);
            });
        });
    }

    download(url, dest, progress) {
        return new Promise((resolve, reject) => {
            this.getLocationURL(url).then((locationUrl) => {
                // Remove dest file if already exist
                if (fs.existsSync(dest)) {
                    fs.unlinkSync(dest);
                }
                this.canceled = false;
                const file = fs.createWriteStream(dest);
                const request = https.get(locationUrl, (response) => {
                    if (response.statusCode !== 200) {
                        return reject(new Error(`Response status code: ${response.statusCode}, but expected 200.`));
                    }
                    const size = parseInt(response.headers['content-length'], 10);
                    let downloaded = 0;
                    typeof progress === 'function' && response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        progress({
                            total: size,
                            done: downloaded
                        });
                        if (this.canceled) {
                            request.end();
                            file.end();
                            fs.unlink(dest);
                            resolve(null);
                        }
                    });
                    response.pipe(file);
                });
                file.on('finish', () => file.close((...args)=> {
                    resolve(file);
                }));
                request.on('error', (error) => {
                    fs.unlink(dest);
                    reject(error);
                });
                file.on('error', (error) => { 
                    fs.unlink(dest); 
                    reject(error);
                });
            }).catch((error) => {
                reject(error);
            });            
        });
    }

    cancelDownload() {
        this.canceled = true;
    }

    getJSON(smth) {
        if (typeof smth === 'object' && smth !== null) {
            return smth;
        }
        if (typeof smth !== 'string') {
            return new Error(`Cannot parse, because typeof of input is ${typeof smth}`);
        }
        try {
            return JSON.parse(smth);
        } catch (error) {
            return error;
        }
    }
}

module.exports = Connector;
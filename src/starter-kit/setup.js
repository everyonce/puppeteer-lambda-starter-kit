const aws = require('aws-sdk');
const s3 = new aws.S3({apiVersion: '2006-03-01'});
const fs = require('fs');
const tar = require('tar');
const puppeteer = require('puppeteer');
const config = require('./config');

exports.getBrowser = (() => {
  console.log("starting getbrowser");
  let browser;
  return async () => {
    if (typeof browser === 'undefined' || !await isBrowserAvailable(browser)) {
      console.log("got a browser, starting it.");
      await setupChrome();
      browser = await puppeteer.launch({
        headless: true,
        executablePath: config.executablePath,
        args: config.launchOptionForLambda,
        dumpio: !!exports.DEBUG,
      });
      console.log(async (b) => `launch done: ${await browser.version()}`);
    }
  console.log("returning browser");
    return browser;
  };
})();

const isBrowserAvailable = async (browser) => {
  try {
    await browser.version();
  } catch (e) {
     console.log(e); // not opened etc.
    return false;
  }
  return true;
};

const setupChrome = async () => {
  if (!await existsExecutableChrome()) {
    if (await existsLocalChrome()) {
       console.log('setup local chrome');
      await setupLocalChrome();
    } else {
       console.log('setup s3 chrome');
      await setupS3Chrome();
    }
     console.log('setup done');
  }
};

const existsLocalChrome = () => {
  return new Promise((resolve, reject) => {
    fs.exists(config.localChromePath, (exists) => {
      resolve(exists);
    });
  });
};

const existsExecutableChrome = () => {
  return new Promise((resolve, reject) => {
    fs.exists(config.executablePath, (exists) => {
      resolve(exists);
    });
  });
};

const setupLocalChrome = () => {
  return new Promise((resolve, reject) => {
    fs.createReadStream(config.localChromePath)
    .on('error', (err) => reject(err))
    .pipe(tar.x({
      C: config.setupChromePath,
    }))
    .on('error', (err) => reject(err))
    .on('end', () => resolve());
  });
};

const setupS3Chrome = () => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: config.remoteChromeS3Bucket,
      Key: config.remoteChromeS3Key,
    };
    s3.getObject(params)
    .createReadStream()
    .on('error', (err) => reject(err))
    .pipe(tar.x({
      C: config.setupChromePath,
    }))
    .on('error', (err) => reject(err))
    .on('end', () => resolve());
  });
};


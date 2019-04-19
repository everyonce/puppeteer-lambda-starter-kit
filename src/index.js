const setup = require('./starter-kit/setup');
const dateFormat = require('dateformat');

// this handler signature requires AWS Lambda Nodejs v8.1
exports.handler = async (event, context) => {
  const browser = await setup.getBrowser();

  return await exports.run(browser);
};

exports.run = async (browser) => {
  // implement here
  // this is sample
  const page = (await browser.pages())[0];
  await page.goto('https://www2.empoweredbymarathon.com/avs_marathon/jsp/login/marathon_login.jsp',
      {waitUntil: ['domcontentloaded', 'networkidle0']}
  );

  // dom element selectors
  const USERNAME_SELECTOR = 'input[name=username]';
  const PASSWORD_SELECTOR = 'input[name=password]';
  const BUTTON_SELECTOR = 'input[name=Submit]';
  const CREDS = require('./marathoncreds');

  // initial login

  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(CREDS.username);

  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(CREDS.password);

  await page.click(BUTTON_SELECTOR);
  await page.waitForNavigation();

  await page.goto('https://www2.empoweredbymarathon.com/avs_marathon/jsp/dailybusiness/bol.jsp');

  const todayD=new Date();
  const today=dateFormat(todayD, 'mm/dd/yyyy');
  const yesterday=dateFormat(todayD-(60*1000*60*24), 'mm/dd/yyyy');
  const filename='bol/marathon/'+dateFormat(todayD, 'yyyymmdd-HHMMss') +
     '-marathon-bol.csv';
  process.stdout.write('today: '+today+'\n');
  process.stdout.write('yesterday: '+yesterday+'\n');

  const START_DATE_SELECTOR = 'input[name=startDateOut]';
  const END_DATE_SELECTOR = 'input[name=endDateOut]';
  const SEARCH_BUTTON_SELECTOR = 'input[name=submit][type=image]';
  // const FORM_SELECTOR = 'form[name=downloadbol]';
  const DOWNLOAD_BUTTON_SELECTOR = 'input[name=button2][type=image]';


  process.stdout.write('clicking start day selector\n');
  const startInput = await page.$(START_DATE_SELECTOR);
  await startInput.click({clickCount: 3});
  process.stdout.write('typing: '+yesterday+'\n');
  await startInput.type(yesterday);


  process.stdout.write('clicking end day selector\n');
  const endInput = await page.$(END_DATE_SELECTOR);
  await endInput.click({clickCount: 3});
  process.stdout.write('typing: '+today+'\n');
  await endInput.type(today);

  process.stdout.write('clicking search button selector\n');
  await page.click(SEARCH_BUTTON_SELECTOR);
  await page.waitForSelector(DOWNLOAD_BUTTON_SELECTOR);

  await page.setRequestInterception(true);

  page.click(DOWNLOAD_BUTTON_SELECTOR);

  const xRequest = await new Promise((resolve) => {
    page.on('request', (request) => {
      process.stdout.write('intercepted request.\n');
      request.abort();
      resolve(request);
      process.stdout.write('cancelled request.\n');
    });
  });


  const request = require('request-promise');
  const options = {
    encoding: null,
    method: xRequest._method,
    uri: xRequest._url,
    body: xRequest._postData,
    headers: xRequest._headers,
  };

  /* add the cookies */
  const cookies = await page.cookies();
  options.headers.Cookie =
       cookies.map((ck) => ck.name + '=' + ck.value).join(';');

  process.stdout.write('sending new request.\n');
  /* resend the request */
  const response = await request(options);

  // process.stdout.write(response);

  const AWS = require('aws-sdk');

  const s3 = new AWS.S3();
  const params = {Bucket: 'rogers-bol-poc', Key: filename, Body: response};
  s3.upload(params, function(err, data) {
    console.log(err, data);
  });
  process.stdout.write('all done.\n');

  await page.close();

  return 'done';
};

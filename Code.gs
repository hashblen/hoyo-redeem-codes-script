const scriptProperties = PropertiesService.getScriptProperties();

/** REPLACE PARAMETERS WITH THE ONES YOU GOT **/
const urlDict = {
  'genshin': 'https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?lang=en&game_biz=hk4e_global&uid=715052227&region=os_euro',
  'hsr': 'https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?lang=en&game_biz=hkrpg_global&uid=701683615&region=prod_official_eur',
  'zzz': 'https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?lang=en&game_biz=nap_global&uid=1500028068&region=prod_gf_eu'
}

const discord_notify = true
/** REMEMBER TO SET THOSE AND COOKIE IN PROJECT SETTINGS > SCRIPT PROPERTIES **/
const myDiscordID = scriptProperties.getProperty('DISCORD_ID')
const discordWebhook = scriptProperties.getProperty('WEBHOOK_URL')

const verbose = false
let first_run = false

function fetchJson() {
  const jsonUrl = 'https://db.hashblen.com/codes'; // Replace with your JSON endpoint URL
  const response = UrlFetchApp.fetch(jsonUrl);
  const jsonData = JSON.parse(response.getContentText());
  return jsonData;
}

const ALREADY_IN_USE = -2017
const ALREADY_IN_USE_2 = -2018
const EXPIRED = -2001
const INVALID = -2003
const SUCCESSFUL = 0

function sendGetRequestsWithCdkeys() {
  const cdkeysbygame = fetchJson(); // {'genshin': [], 'hsr': [{'code': '4TKSX77Y58QK'}, {'code': 'HAOCHIXIANZHOU'}], 'zzz': []};

  let results = [];

  for (const game in urlDict) {
    const fullUrl = urlDict[game];
    if(!fullUrl) {
      continue
    }
    const cdkeys = cdkeysbygame[game];
    cdkeys.forEach(function(cdkeydict) {
      const added_at = cdkeydict.added_at;
      if(!first_run && added_at < Date.now()/1000 - 60*60*24*1.5) {
        // If code was added more than 1.5 days ago, don't try it.
        return
      }
      const cookies = scriptProperties.getProperty(`COOKIE`); // Replace with your actual cookie token in the script properties!!!
      const cdkey = cdkeydict.code;
      const url = replaceCdkeyInUrl(fullUrl, cdkey);

      const options = {
        'method': 'get',
        'headers': {
          'Cookie': `${cookies}`,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Connection': 'keep-alive',
          'x-rpc-app_version': '2.34.1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'x-rpc-client_type': '4',
        },
        'muteHttpExceptions': true
      };

      try {
        const response = UrlFetchApp.fetch(url, options);
        const jsonData = JSON.parse(response.getContentText());
        const retcode = jsonData.retcode;
        let resultText = `${game}: ${cdkey}: ${jsonData.message}`;
        if(verbose) {
          resultText += ` ${response}`;
        }
        Logger.log(resultText);
        if(verbose || ![ALREADY_IN_USE, ALREADY_IN_USE_2].includes(retcode)) {
          results.push(resultText); // Store the result in the array
        }
      } catch (e) {
        Logger.log(`${game}: Failed to send request for ${cdkey}: ${e.message}`);
        results.push(`$${game}: {cdkey}: Failed to send request`); // Store the error in the array
      };
      Utilities.sleep(5500);
    });

  }

  return results.join('\n'); // Join all results into a single string and return
}


function replaceCdkeyInUrl(url, cdkey) {
  // Remove any existing cdkey parameter
  let cleanedUrl = url.replace(/cdkey=[^&]*(&)?/, '');

  // Ensure no trailing '&' or '?' is left dangling
  cleanedUrl = cleanedUrl.replace(/[\?&]$/, '');

  // Append the new cdkey parameter
  const separator = cleanedUrl.includes('?') ? '&' : '?';
  return `${cleanedUrl}${separator}cdkey=${cdkey}`;
}

function first_main() {
  Logger.log("Running first_main, only run this the first time or when you had errors for more than a day so that you test old but not expired codes too.")
  first_run = true;
  main();
}

function main() {
  let hoyoResp = sendGetRequestsWithCdkeys();

  if (discord_notify && discordWebhook && hoyoResp) {
    postWebhook(hoyoResp);
  }
}

function discordPing() {
  return myDiscordID ? `<@${myDiscordID}>, ` : '';
}

function postWebhook(data) {
  let payload = JSON.stringify({
    'username': 'auto-redeem',
    'avatar_url': 'https://i.imgur.com/LI1D4hP.png',
    'content': `${discordPing()}You have redeemed new codes or got errors.\n${data}`
  });

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(discordWebhook, options);
  Logger.log(`Posted to webhook, returned ${response}`)
}




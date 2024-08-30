const scriptProperties = PropertiesService.getScriptProperties();

/** REPLACE PARAMETERS WITH THE ONES YOU GOT **/
const profiles = {
  main: {
    'genshin': 'https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?lang=en&game_biz=hk4e_global&uid=715052227&region=os_euro',
    'hsr': 'https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?lang=en&game_biz=hkrpg_global&uid=701683615&region=prod_official_eur',
    'zzz': 'https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?lang=en&game_biz=nap_global&uid=1500028068&region=prod_gf_eu'
  }
};

const discord_notify = true
/** REMEMBER TO SET THOSE AND COOKIE IN PROJECT SETTINGS > SCRIPT PROPERTIES **/
const myDiscordID = scriptProperties.getProperty('DISCORD_ID')
const discordWebhook = scriptProperties.getProperty('WEBHOOK_URL')

const verbose = false
let first_run = false
let error = false
const cdkeysbygame = fetchJson(); // {'genshin': [], 'hsr': [{'code': '4TKSX77Y58QK'}, {'code': 'HAOCHIXIANZHOU'}], 'zzz': []};
const last_execution = scriptProperties.getProperty('last_execution');
if (last_execution <= 0) {
  first_run = true;
}

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

function sendGetRequestsWithCdkeys(urlDict, profile) {
  let results = [];

  for (const game in urlDict) {
    const fullUrl = urlDict[game];
    if(!fullUrl) {
      continue
    }
    const cdkeys = cdkeysbygame[game];
    cdkeys.forEach(function(cdkeydict) {
      if(!first_run && cdkeydict.added_at * 1000 < last_execution) {
        // If code was added before last run of this script, dont try to redeem it again.
        return
      }
      const cookies = scriptProperties.getProperty('COOKIE_' + profile) ?? scriptProperties.getProperty(`COOKIE`); // Replace with your actual cookie token in the script properties!!!
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
        if(![ALREADY_IN_USE, ALREADY_IN_USE_2, SUCCESSFUL].includes(retcode)) {
          error = true;
        }
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
        error = true;
      }
      Utilities.sleep(5500);
    });

  }

  return results; // Return ARRAY
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
  const hoyoResp = Object.getOwnPropertyNames(profiles)
    .map(name => {
      const results = sendGetRequestsWithCdkeys(profiles[name], name);
      if (results) {
        return results.map(result => `${name}: ${result}`).flat();
      }
      return [];
    })
    .flat();

  if (discord_notify && discordWebhook && hoyoResp.length > 0) {
    sendDiscord(hoyoResp);
  }

  scriptProperties.setProperty('last_execution', Date.now().toString());
}

function discordPing() {
  return myDiscordID && error ? `<@${myDiscordID}>, You got errors while processing redemption codes` : 'Redemption codes redeemed successfully';
}

function sendDiscord(data) {
  let currentChunk = `${discordPing()}\n`;
  
  for (let i = 0; i < data.length; i++) {
    if (currentChunk.length + data[i].length >= 1899) {
      postWebhook(currentChunk);
      currentChunk = '';
    }
    currentChunk += `${data[i]}\n`;
  }
  if (currentChunk) {
    postWebhook(currentChunk);
  }
}

function postWebhook(data) {
  let payload = JSON.stringify({
    'username': 'auto-redeem',
    'avatar_url': 'https://i.imgur.com/LI1D4hP.png',
    'content': data
  });

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(discordWebhook, options);
  Logger.log(`Posted to webhook, returned ${response}`);
}

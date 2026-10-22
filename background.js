// Change this if you use a different Outlook web address
const OUTLOOK_URL = "https://outlook.office.com/mail/inbox";
const OUTLOOK_PATTERNS = [
  "https://outlook.office.com/*",
  "https://outlook.office365.com/*",
  "https://outlook.live.com/*",
];
const MAX_ATTEMPTS = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 30000);
  });
}

async function readFromTab(tabId) {
  // content script may need a moment to be injected
  for (let i = 0; i < 10; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "READ_LATEST_MAIL" });
    } catch (e) {
      await sleep(1000);
    }
  }
  return { error: "Outlook content script not reachable" };
}

async function ensureOutlookTab() {
  let [tab] = await chrome.tabs.query({ url: OUTLOOK_PATTERNS });
  if (!tab) {
    tab = await chrome.tabs.create({ url: OUTLOOK_URL, active: false });
    await waitForLoad(tab.id);
  }
  return tab;
}

async function fetchOtp() {
  const { lastOtp } = await chrome.storage.local.get("lastOtp");
  const tab = await ensureOutlookTab();

  // poll the already-open Outlook tab (no reload) — Outlook updates the list live
  for (let attempt = 1; attempt <= 40; attempt++) {
    const res = await readFromTab(tab.id);
    if (res && res.otp && res.otp !== lastOtp) {
      await chrome.storage.local.set({ lastOtp: res.otp });
      return { otp: res.otp };
    }
    // safety net: full reload every ~12s in case live update is throttled
    if (attempt % 8 === 0) {
      await chrome.tabs.reload(tab.id);
      await waitForLoad(tab.id);
    }
    await sleep(1500);
  }
  return { error: "No new OTP mail found in Outlook" };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "WARMUP") {
    ensureOutlookTab().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "GET_OTP") {
    fetchOtp().then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
    return true; // async response
  }
});

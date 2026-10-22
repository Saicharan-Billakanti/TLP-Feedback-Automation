const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Mail looks like: "OTP for Student Feedback Verification is cLgIq"
function extractOtp(text) {
  if (!text) return null;
  const m = text.match(/Verification\s+is\s*[:\-]?\s*([A-Za-z0-9]{4,10})\b/i);
  return m ? m[1] : null;
}

async function waitFor(fn, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(500);
  }
  return null;
}

const SUBJECT = /OTP for Student Portal Feedback/i;

async function readLatest() {
  // newest mail with the feedback OTP subject (list is sorted newest first)
  const item = await waitFor(() =>
    [...document.querySelectorAll('[role="listbox"] [role="option"]')].find((o) =>
      SUBJECT.test(o.innerText || o.getAttribute("aria-label") || "")
    ), 4000
  );
  if (!item) return { error: "OTP mail not found in list" };

  item.click();

  // wait until the reading pane shows the body text
  const otp = await waitFor(() => {
    const pane =
      document.querySelector('[aria-label="Reading pane"]') ||
      document.querySelector('[role="main"]');
    return extractOtp(pane && pane.innerText);
  }, 4000);

  return otp ? { otp } : { error: "OTP text not found in mail" };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "READ_LATEST_MAIL") {
    readLatest().then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
});

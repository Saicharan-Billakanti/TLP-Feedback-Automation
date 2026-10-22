(() => {
  const KEY = "tlpAutofillRunning";
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };

  // Only show on pages that look like the feedback questionnaire
  const pageHasQuestions = () => /QUESTION\s*-\s*\d+/i.test(document.body.innerText);
  if (!pageHasQuestions()) return;

  const getRunning = () => sessionStorage.getItem(KEY) === "1";
  const setRunning = (v) => sessionStorage.setItem(KEY, v ? "1" : "0");

  // ---- floating control button ----
  const btn = document.createElement("button");
  btn.style.cssText =
    "position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:12px 18px;" +
    "background:#0d6efd;color:#fff;border:none;border-radius:8px;font:600 14px sans-serif;" +
    "cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)";
  const status = document.createElement("div");
  status.style.cssText =
    "position:fixed;bottom:70px;right:20px;z-index:2147483647;padding:6px 10px;" +
    "background:#222;color:#fff;border-radius:6px;font:12px sans-serif;display:none";
  document.body.append(btn, status);

  const say = (msg) => { status.textContent = msg; status.style.display = "block"; console.log("[TLP]", msg); };
  const refreshBtn = () => (btn.textContent = getRunning() ? "⏹ Stop Autofill" : "▶ Start Autofill");
  btn.onclick = () => {
    sessionStorage.removeItem("tlpOtpSent");
    if (!getRunning()) chrome.runtime.sendMessage({ type: "WARMUP" }); // open Outlook in background now
    setRunning(!getRunning());
    refreshBtn();
    if (getRunning()) step(); else say("Stopped");
  };
  refreshBtn();

  // ---- helpers ----
  const findValidateBtn = () =>
    [...document.querySelectorAll("button, input[type=button], input[type=submit], a")].find(
      (b) => isVisible(b) && /validate\s*&?\s*(amp;)?\s*finish|validate/i.test(b.innerText || b.value || "")
    );

  const findOtpField = () => {
    const inputs = [...document.querySelectorAll("input")].filter(
      (i) => isVisible(i) && !["radio", "checkbox", "hidden", "button", "submit"].includes(i.type)
    );
    const byName = inputs.find((i) =>
      (i.name + " " + i.id + " " + i.placeholder + " " + (i.getAttribute("aria-label") || "")).toLowerCase().includes("otp")
    );
    if (byName) return byName;
    // FINISH page: the only text box next to the "Validate & Finish" button
    return findValidateBtn() ? inputs[0] : undefined;
  };

  const findSaveNext = () =>
    [...document.querySelectorAll("button, input[type=button], input[type=submit], a")].find(
      (b) => isVisible(b) && /save\s*&?\s*(amp;)?\s*next|submit|save/i.test(b.innerText || b.value || "") &&
             !/autofill/i.test(b.innerText || "")
    );

  // First option: prefer real radio inputs, else the element whose text starts with "1)"
  const findFirstOption = () => {
    const radios = [...document.querySelectorAll("input[type=radio]")].filter((r) => !r.disabled);
    const visibleRadios = radios.filter((r) => isVisible(r) || isVisible(r.closest("label,div")));
    if (visibleRadios.length) return visibleRadios[0];

    const cands = [...document.querySelectorAll("label, div, li, span, p")].filter(
      (e) => isVisible(e) && /^\s*1\s*[\)\.]/.test(e.innerText || "") && (e.innerText || "").length < 80
    );
    // choose the innermost match
    return cands.find((e) => !cands.some((o) => o !== e && e.contains(o)));
  };

  const click = (el) => {
    el.scrollIntoView({ block: "center" });
    el.click();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let busy = false;

  async function step() {
    if (busy || !getRunning()) return;
    busy = true;
    try {
      const otp = findOtpField();
      if (otp) {
        say("OTP required — fetching from Outlook…");
        const res = await chrome.runtime.sendMessage({ type: "GET_OTP" });
        if (!res || !res.otp) {
          setRunning(false); refreshBtn();
          otp.focus();
          say((res && res.error) || "Could not get OTP — enter it manually.");
          return;
        }
        // set value in a way React/Angular/Vue notice
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(otp, res.otp);
        otp.dispatchEvent(new Event("input", { bubbles: true }));
        otp.dispatchEvent(new Event("change", { bubbles: true }));
        say("OTP filled: " + res.otp);
        await sleep(500);
        const submit = findValidateBtn();
        if (!submit) { setRunning(false); refreshBtn(); say("OTP filled — click Validate & Finish yourself."); return; }
        click(submit);
        setRunning(false); refreshBtn();
        say("Done — Validate & Finish clicked.");
        return;
      }

      // FINISH page: click SEND OTP, then wait for the OTP box
      const sendOtp = [...document.querySelectorAll("button, input[type=button], input[type=submit], a")].find(
        (b) => isVisible(b) && /send\s*otp/i.test(b.innerText || b.value || "")
      );
      if (sendOtp) {
        if (sessionStorage.getItem("tlpOtpSent") === "1") {
          setRunning(false); refreshBtn();
          say("OTP box not found after SEND OTP — enter the OTP manually.");
          return;
        }
        sessionStorage.setItem("tlpOtpSent", "1"); // click only once, avoid spamming mails
        say("Clicking SEND OTP…");
        click(sendOtp);
        for (let i = 0; i < 30 && !findOtpField(); i++) await sleep(500);
        busy = false;
        step(); // OTP box found (or not) — handled at the top of step()
        return;
      }

      // wait for the question to be rendered
      let opt;
      for (let i = 0; i < 20 && !(opt = findFirstOption()); i++) await sleep(300);
      if (!opt) { say("No options found — finished or page not ready."); setRunning(false); refreshBtn(); return; }

      click(opt);
      const label = opt.closest && opt.closest("label");
      if (label && opt.tagName !== "INPUT") click(label);
      say("Selected first option");
      await sleep(400);

      const next = findSaveNext();
      if (!next) { say("Save & Next button not found"); setRunning(false); refreshBtn(); return; }
      say("Clicking Save & Next…");
      click(next);

      // If the page doesn't reload (AJAX), check again after a delay
      await sleep(2500);
      busy = false;
      step();
    } finally {
      busy = false;
    }
  }

  // After a page reload, resume automatically
  if (getRunning()) setTimeout(step, 800);
})();

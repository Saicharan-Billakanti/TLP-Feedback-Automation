# TLP Feedback Automation

A Chrome extension that automates the Class TLP feedback form: it selects the first option for every question, clicks **Save & Next**, and on the final page sends the OTP, reads it from your Outlook Web inbox, fills it in and clicks **Validate & Finish**.

> Use it only for your own feedback and your own mailbox. It runs entirely in your browser; nothing is sent anywhere else.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this folder.

## How to use (step by step)

1. Log in to Outlook Web (`https://outlook.office.com/mail/inbox`) in the same Chrome profile and keep that tab open (optional, but it makes the OTP step faster).
2. Log in to the student portal, select the faculty and open the feedback page (the one showing "QUESTION - 1").
3. Click the blue **Start Autofill** button at the bottom-right of the page.
4. The extension selects option 1, clicks **Save & Next**, waits for the page to reload and repeats for every question.
5. On the FINISH page it clicks **SEND OTP** (once only), reads the newest "OTP for Student Portal Feedback" mail from Outlook, types the OTP and clicks **Validate & Finish**.
6. Click **Stop Autofill** at any time to halt. If something fails, the small black box at the bottom-right shows the reason and you can finish manually.

## Configuration

- If your Outlook address is not `outlook.office.com`, change `OUTLOOK_URL` in `background.js` and the URLs in `manifest.json`.
- If your OTP mail has a different subject, change `SUBJECT` in `outlook.js`.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension config and permissions |
| `content.js` | Runs on the feedback page: picks options, clicks buttons, fills the OTP |
| `background.js` | Opens/polls the Outlook tab and returns the OTP |
| `outlook.js` | Runs on Outlook Web: finds the OTP mail and extracts the code |

## Notes

- The selectors are text-based and may need small tweaks if the portal or Outlook changes its layout.
- The first option is always chosen; edit `findFirstOption` in `content.js` to change that.

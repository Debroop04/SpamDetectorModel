# Call Shield

Call Shield answers unknown callers with an AI assistant, checks what they say for scams, connects safe callers to you, and reports scam calls to the nearest police station by email.

Everything runs on free services: a Twilio free trial for real phone calls, OpenStreetMap for police stations and maps, Gmail for email, and the team's own ML model for detection.

## How a call works

```
Caller ──► Twilio number or browser call
              │
              ▼
   AI assistant answers (English or Hindi)
   "Please say your name and why you are calling"
              │  speech to text (Twilio)
              ▼
   Detection = ML model + scam phrase rules + number history
              │
   ┌──────────┼──────────────────────┐
   ▼          ▼                      ▼
  Safe     Suspicious              Scam
  Your     One more question,      Call ends, number is flagged,
  phone    then voicemail          complaint emailed to the nearest
  rings                            police station (with PDF + map)
```

The dashboard shows each call live: the transcript, the risk score, and buttons to block or connect while the AI is still talking.

## Test logins

| Account | Email | Password |
|---|---|---|
| Super admin | `admin@example.com` | `Admin@12345` |
| Test user | your Gmail address with `+callshield-test` before the `@` | `Test@12345` |

Create more from the terminal (in `backend/` with the virtual environment active):

```bash
python -m app.cli create-user --name "New Admin" --email admin2@example.com --password "Admin@12345" --admin
python -m app.cli set-password --email admin@example.com --password "NewPass@123"
```

The admin sees **Admin** in the sidebar: platform totals, every user (make admin, delete), and every police report.

## What is inside

| Folder | What it is |
|---|---|
| `backend/` | FastAPI + SQLite. Twilio webhooks, detection, police lookup, reports, live updates |
| `frontend/` | Next.js 16 web app (dashboard, calls, reports, map, numbers, test call, settings, admin, download page) |
| `android/` | Native Android app (Kotlin + Jetpack Compose, about 3 MB) that screens calls to your own SIM |
| `spam-detector/` | The ML team's model (`spam_model.pkl`, `tfidf_vectorizer.pkl`, `spam_numbers.csv`). Read-only |

| Free service | Used for |
|---|---|
| Twilio trial | Real calls, speech recognition, voice, call forwarding, voicemail, browser calling |
| OpenStreetMap (Overpass, Photon, Nominatim) | Finding police stations and addresses near the user |
| Esri canvas tiles + Leaflet | Maps |
| Gmail SMTP | Sending complaint emails |
| MyMemory | Hindi to English translation (an offline model is optional) |
| ngrok or cloudflared | A public HTTPS address so Twilio can reach your laptop |

## Setup

You need Python 3.11 or newer, Node.js 20 or newer, and either ngrok or cloudflared.

### 1. Backend

```bash
cd ai-call-agent/backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Create `ai-call-agent/backend/.env` with these values (steps 3 to 5 explain where each comes from):

```env
SECRET_KEY=any-long-random-text
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_NAME=Call Shield

# Optional
PUBLIC_BASE_URL=
FALLBACK_POLICE_EMAIL=
ALLOW_LIVE_POLICE_EMAIL=false
TRANSLATOR=auto
```

### 2. Frontend

```bash
cd ai-call-agent/frontend
npm install
npm run dev
```

Create `ai-call-agent/frontend/.env` with one line:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Open http://localhost:3000, create an account, and follow the setup checklist on the dashboard.

### 3. Twilio (free trial)

1. Sign up at https://www.twilio.com/try-twilio.
2. In the Console, copy the **Account SID** and **Auth Token** into `backend/.env`.
3. Get the free trial phone number (Phone Numbers > Buy a number) and put it in `TWILIO_PHONE_NUMBER`, for example `+15551234567`.
4. Under Phone Numbers > Verified Caller IDs, verify your own mobile number. Safe calls are forwarded to it.
5. Under Voice > Settings > Geo permissions, allow **India** so calls can be forwarded to Indian numbers.

When the backend starts, it sets up browser calling and points your number at itself automatically. You can repeat this any time with **Settings > System > Reconnect Twilio**.

Newer trial accounts hide the phone number from Twilio's API, and they don't allow starting a caller ID verification through the API. If **Settings > System > Phone line** shows a warning, do these two steps once in the Console:

1. **Phone Numbers > Manage > Active numbers > your number > Voice configuration:** set "A call comes in" to **TwiML App** and pick **Call Shield Browser Calls**, then save. The backend keeps that app's address up to date, so you never have to change it again.
2. **Phone Numbers > Manage > Verified Caller IDs > Add a new Caller ID:** add your mobile and enter the code Twilio sends. Without this, Twilio refuses to forward safe calls to you (error 21219).

### 4. Public address for Twilio

Twilio has to reach your backend over the internet. Start one of these in a new terminal, then restart the backend (or press Reconnect Twilio):

```bash
# cloudflared: free, no account (macOS: brew install cloudflared)
cloudflared tunnel --url http://localhost:8000 --metrics 127.0.0.1:20241
# or ngrok: free account and `ngrok config add-authtoken <token>` needed once
ngrok http 8000
```

The cloudflared address changes every time it starts; the backend picks up the new one automatically.

The backend finds the tunnel address by itself. You can also set `PUBLIC_BASE_URL` in `backend/.env`.

### 5. Email (Gmail)

1. Turn on 2-Step Verification for your Google account.
2. Create an app password at https://myaccount.google.com/apppasswords.
3. Put your Gmail address in `SMTP_USERNAME` and the 16-letter app password in `SMTP_PASSWORD`.

### 6. Finish in the app

In **Settings**:

1. Add your phone number (the verified one).
2. Set your location. The nearest police station is chosen automatically.
3. Check the station email. Many stations in OpenStreetMap have no email, so add the official address from your state police website, or set `FALLBACK_POLICE_EMAIL` (for example a district cyber cell).
4. Activate the protection line.

## Trying it

- **Browser call (free, no phone needed):** open **Test call**, press the green button, press `1` for English or `2` for Hindi, and read one of the sample lines. Watch the dashboard and the Police reports page update live.
- **Phone call:** call your Twilio number from a verified phone. On a trial account you will first hear a short Twilio message and must press a key.

### Test mode and live mode

Reports start in **test mode**. The complaint email goes to your own inbox, marked `[TEST]`, and shows which police station it would have gone to. This keeps real police stations from receiving test reports.

To email real police stations:

1. Set `ALLOW_LIVE_POLICE_EMAIL=true` in `backend/.env`.
2. Choose **Police station** under **Settings > Report delivery**.

The station gets the email with the PDF attached and a link to a page where it can **acknowledge** the complaint without logging in. Your dashboard updates as soon as it does.

## Twilio trial limits

| Limit | Effect |
|---|---|
| Only verified numbers can call the trial number (up to 5) | Verify the phones you demo with, or use browser calls |
| A short trial message plays first and the caller presses a key | Press any key, then the AI answers |
| Calls are forwarded only to verified numbers | Verify your own mobile |
| The trial number is a US number | Calling it from an Indian SIM is an international call; browser calls avoid this |
| Calls last at most 10 minutes | Enough for screening |

Upgrading the Twilio account removes these limits. No code changes are needed.

## Android app

The app protects calls to **your own SIM number**:

```
Incoming call to your phone
 ├─ Saved contact or your AI line   → rings normally (the AI never talks to contacts)
 ├─ Blocked or reported scam number → declined at once
 └─ Unknown number                  → declined, your SIM forwards it to the Twilio number,
                                       the AI screens it, scams are reported and blocked next time
```

The decision is made on the phone in milliseconds from a cached list (blocked, trusted and community-reported numbers), so it never misses Android's 5 second limit. Contacts are checked on the phone and never uploaded.

### Install and connect

1. Run the backend on your network: `uvicorn app.main:app --host 0.0.0.0 --port 8000`, and the website with `npx next dev -H 0.0.0.0 -p 3000`.
2. On the phone (same Wi-Fi), open `http://<computer's Wi-Fi IP>:3000/download` and tap **Download APK**. Allow the install when Android asks.
3. Back on the download page, tap **Open app and connect**. The app also finds the server on the Wi-Fi by itself, or you can type the address.
4. Sign in, then follow the **Set up protection** checklist:
   - allow call screening, contacts, notifications and location;
   - set **forward when busy** to your Twilio number. The app dials `**67*<number>#` for you; on Jio use Phone settings > Calls > Call forwarding > When busy.

If the Wi-Fi blocks devices from seeing each other (common on college networks), use the public tunnel address shown on the download page instead.

### Build the APK

Needs JDK 17 and the Android SDK (platform 37.2).

```bash
cd ai-call-agent/android
./gradlew testDebugUnitTest      # screening rule tests
./gradlew publishApk             # signed release APK to frontend/public/downloads + version.json
```

Release signing reads `android/keystore.properties` (not committed). Without it the debug key is used. Raise `versionCode` in `app/build.gradle.kts` for each release; the app shows an update card when the website has a newer version.

## Detection

The final risk score combines three signals:

- **ML model:** the team's TF-IDF + Logistic Regression model, run on everything the caller said (Hindi is translated to English first).
- **Scam phrase rules:** OTP and PIN requests, KYC and bank threats, fake police or CBI ("digital arrest"), lottery prizes, fee demands, AnyDesk and TeamViewer, electricity cut-off threats, job and crypto scams. They cover English, Hinglish and Hindi.
- **Number history:** reports from `spam_numbers.csv` and from users of this app.

| Score | Result | What happens |
|---|---|---|
| 75% or more (adjustable in Settings) | Scam | Call ends and is reported |
| 45% to 75% | Suspicious | One more question, then voicemail |
| Below 45% | Safe | Your phone rings |

Numbers with many reports are blocked before the caller says anything.

## Tests

```bash
cd ai-call-agent/backend && source .venv/bin/activate && python -m pytest -q
cd ai-call-agent/frontend && npm run lint && npm run build
```

The backend tests send signed webhook requests, exactly like Twilio does, through the full call flow. They cover safe, suspicious, scam, silent and Hindi calls, police reports, test and live delivery, acknowledgement, and the map lookups.

## Optional: offline Hindi translation

```bash
pip install -r requirements-hindi.txt
```

This installs the `Helsinki-NLP/opus-mt-hi-en` model (about 1 GB with PyTorch). The backend uses it automatically when present.

## Troubleshooting

| Problem | Fix |
|---|---|
| Settings > System shows "No public URL" | Start ngrok or cloudflared, then press Reconnect Twilio |
| A call says "not set up yet" | Activate the protection line in Settings |
| Report status is "Failed" | Check `SMTP_USERNAME` and `SMTP_PASSWORD`, then press Send again |
| Report status is "Needs email" | Add the police station email in Settings > Police station |
| Safe calls do not reach your phone | Verify your number in Twilio and allow India in Geo permissions |
| Police stations load slowly | The free OpenStreetMap servers can be busy; the app tries several and falls back to Photon and Nominatim |

National Cyber Crime Helpline: **1930** · https://cybercrime.gov.in

# First Coast Property Care — Property Health Card App

A mobile-first property inspection app with photo capture, PDF export, and email reporting.

---

## 🚀 Deploy in 4 Steps

### Step 1: Set Up Supabase (free database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **"New Project"** — name it `fcpc-health-card`
3. Choose a strong database password (save it somewhere)
4. Wait ~2 minutes for it to spin up
5. Go to **SQL Editor** (left sidebar) → **New Query**
6. Paste the contents of `supabase-setup.sql` and click **Run**
7. Go to **Settings** → **API** and copy:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **anon/public key** (the long string under "Project API keys")

### Step 2: Set Up EmailJS (free email sending)

1. Go to [emailjs.com](https://emailjs.com) and create a free account
2. Click **"Add New Service"** → choose **Gmail** → connect your Gmail
3. Copy your **Service ID** (like `service_abc123`)
4. Click **"Email Templates"** → **"Create New Template"**
5. Set up the template:
   - **To email:** `{{to_email}}`
   - **From name:** `{{from_name}}`
   - **Subject:** `{{subject}}`
   - **Body:** `{{message}}`
6. Save and copy your **Template ID** (like `template_abc123`)
7. Go to **Account** → **API Keys** → copy your **Public Key**

### Step 3: Configure & Deploy to Vercel

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your values in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_EMAILJS_SERVICE_ID=service_abc123
   VITE_EMAILJS_TEMPLATE_ID=template_abc123
   VITE_EMAILJS_PUBLIC_KEY=your-public-key
   ```

3. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "First Coast Property Care app"
   git remote add origin https://github.com/YOUR-USERNAME/fcpc-health-card.git
   git push -u origin main
   ```

4. Deploy on Vercel:
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click **"Add New Project"** → import your repo
   - Under **Environment Variables**, add the same 5 variables from `.env.local`
   - Click **Deploy**
   - Your app is live! 🎉

### Step 4: Add to Your Phone

1. Open the Vercel URL on your phone's browser
2. **iPhone:** Tap Share → "Add to Home Screen"
3. **Android:** Tap the menu → "Add to Home Screen"
4. It now works like a native app with your logo as the icon!

---

## 📁 Project Structure

```
fcpc-app/
├── public/
│   ├── logo.png          ← Your logo
│   ├── logo-192.png      ← PWA icon (small)
│   └── logo-512.png      ← PWA icon (large)
├── src/
│   ├── main.jsx          ← Entry point
│   ├── App.jsx           ← Main app component
│   ├── constants.js      ← Colors, sections, checklists
│   ├── supabase.js       ← Database (with localStorage fallback)
│   ├── email.js          ← EmailJS integration
│   └── utils.js          ← Image compression, helpers
├── .env.example          ← Template for environment variables
├── supabase-setup.sql    ← Run this in Supabase SQL Editor
├── vite.config.js        ← Vite + PWA config
├── package.json          ← Dependencies
└── index.html            ← HTML shell
```

---

## 💡 Features

- **Mobile-first** — designed for field use on your phone
- **Camera + Gallery** — capture photos per checklist item
- **Per-item notes** — auto-appears when Fair/Attention/N/A is selected
- **PDF export** — branded report with your logo, prints from browser
- **Email reports** — send detailed inspection summaries to customers
- **PWA** — works offline, installable on home screen
- **Cloud sync** — Supabase keeps data across all your devices
- **Auto-save** — changes save automatically as you work

---

## 🔧 Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

---

## 📝 Notes

- **Free tier limits:** Supabase gives 500MB storage + 50,000 rows. EmailJS gives 200 emails/month. Both are more than enough to start.
- **Photos in database:** Photos are stored as base64 in the database. For heavy photo usage (50+ photos per inspection), consider upgrading to Supabase Storage for file uploads.
- **Security:** The current setup uses Supabase's anon key with open RLS policies. Once you're up and running, consider adding authentication (Supabase Auth) to lock it down to just your account.

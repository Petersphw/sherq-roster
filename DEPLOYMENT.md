# 🚀 SHERQ Talk Roster - Deployment Guide

## Recommended Free Deployment Stack

**Best Option: Vercel + Neon PostgreSQL**

- **Vercel** (Frontend/Backend): Free tier includes unlimited bandwidth, 100GB-hours serverless compute
- **Neon PostgreSQL** (Database): Free tier includes 0.5GB storage, 190 compute hours/month
- **Total Cost: $0/month**

---

## 📋 Step-by-Step Deployment

### 1. Push Your Code to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: SHERQ Talk Roster"

# Create a new repository on GitHub, then:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sherq-talk-roster.git
git push -u origin main
```

### 2. Set Up Neon PostgreSQL (Database)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Click **"Create Project"**
   - Name: `sherq-roster`
   - Region: Choose closest to your team (e.g., `Africa (Cape Town)` or `Europe (Frankfurt)`)
   - PostgreSQL version: 15 or 16
3. Once created, copy the **connection string** (looks like):
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. Save this connection string - you'll need it for Vercel

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (free, use GitHub login)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js
5. **Add Environment Variables:**
   - Click **"Environment Variables"**
   - Add: `DATABASE_URL` = (paste your Neon connection string)
6. Click **"Deploy"**

That's it! Vercel will:
- Build your Next.js app
- Deploy to global CDN
- Give you a live URL (e.g., `sherq-roster.vercel.app`)

### 4. Initialize Your Database

Visit your deployed URL and click **"Initialize Roster"** to:
- Create the team members
- Add default SHERQ topics
- Set up the calendar structure

---

## 🔧 Alternative Deployment Options

### Option 2: Railway (All-in-One)

**Pros:** Simpler setup, database + hosting in one place  
**Cons:** $5 free credit/month (may run out)

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Add PostgreSQL plugin
5. Add environment variable: `DATABASE_URL` (Railway auto-generates this)
6. Deploy

### Option 3: Render

**Pros:** Free tier available  
**Cons:** Spins down after 15 min inactivity (slow first load)

1. Go to [render.com](https://render.com)
2. Create **"Web Service"** from GitHub
3. Create **"PostgreSQL"** database
4. Link them via environment variables
5. Deploy

### Option 4: Fly.io

**Pros:** Good free tier, global deployment  
**Cons:** More complex setup

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run: `fly launch`
3. Follow prompts to create app + database
4. Deploy: `fly deploy`

---

## 🌐 Custom Domain (Optional)

### Using Vercel:

1. In your Vercel project, go to **Settings → Domains**
2. Click **"Add"** and enter your domain (e.g., `sherq.sas.co.za`)
3. Update your DNS:
   - **Type:** CNAME
   - **Name:** `sherq` (or `@` for root domain)
   - **Value:** `cname.vercel-dns.com`
4. Wait 5-10 minutes for DNS propagation

### Using Free SSL:
Vercel automatically provides free SSL certificates via Let's Encrypt.

---

## 📊 Monitoring & Limits

### Vercel Free Tier:
- **Bandwidth:** 100GB/month (plenty for internal tool)
- **Serverless Functions:** 100GB-hours/month
- **Build Minutes:** 6,000 minutes/month
- **Team Members:** Up to 100 (Viewer role)

### Neon Free Tier:
- **Storage:** 0.5GB (stores ~50,000 roster entries)
- **Compute:** 190 hours/month (always-on for small teams)
- **Branches:** 10 database branches
- **Auto-suspend:** After 5 minutes of inactivity (wakes in ~1 sec)

**For your SHERQ team of ~12 people, you'll use <5% of these limits.**

---

## 🔄 Updates & Maintenance

### Updating the App:

```bash
# Make changes locally
git add .
git commit -m "Update: added new feature"
git push origin main

# Vercel automatically redeploys!
```

### Database Backups:

Neon provides:
- **Point-in-time recovery:** Last 24 hours (free tier)
- **Manual backups:** Download SQL dump anytime
- **To backup:**
  ```bash
  # In Neon dashboard → Backups → Create Backup
  ```

### Monitoring:

- **Vercel Analytics:** Free, shows page views, performance
- **Neon Dashboard:** Shows database usage, query performance

---

## 🔒 Security Checklist

- [x] Database credentials stored in environment variables (not in code)
- [x] HTTPS enabled by default (Vercel + Neon)
- [x] SQL injection protection (Drizzle ORM uses parameterized queries)
- [x] No sensitive data in client-side code
- [ ] Add authentication if needed (see below)

### Optional: Add Authentication

If you want to restrict access to SAS employees only:

**Option A: Vercel Authentication (Simple)**
1. Go to Vercel project → Settings → Deployment Protection
2. Enable **"Vercel Authentication"**
3. Invite team members via email

**Option B: NextAuth.js (Advanced)**
```bash
npm install next-auth
```
See: [next-auth.js.org](https://next-auth.js.org)

---

## 📱 Mobile Access

The app is fully responsive. Team members can:
- Access via phone browser: `https://your-app.vercel.app`
- **Add to Home Screen** (iOS Safari / Android Chrome) for app-like experience
- Receive calendar invites via Teams integration

---

## 🆘 Troubleshooting

### "Database connection failed"
- Check `DATABASE_URL` environment variable in Vercel
- Ensure Neon database is not suspended (click to wake)
- Verify connection string includes `?sslmode=require`

### "Build failed"
- Check Vercel deployment logs
- Ensure all dependencies are in `package.json`
- Run `npm run build` locally to test

### "Page loads slowly"
- Neon free tier auto-suspends after 5 min inactivity
- First load may take 1-2 seconds to wake database
- Subsequent loads are instant

### "Roster not generating"
- Check browser console for errors
- Verify team members are marked as "Active"
- Ensure at least one presenter is available

---

## 💡 Pro Tips

1. **Custom Branding:**
   - Update `public/images/sas-logo.png` with your company logo
   - Adjust colors in `src/app/globals.css` (`--sas-primary`, etc.)

2. **Email Notifications:**
   - Add [Resend](https://resend.com) (free: 100 emails/day)
   - Send birthday reminders, upcoming talk alerts

3. **Analytics:**
   - Add [Plausible Analytics](https://plausible.io) (privacy-friendly)
   - Track which topics are most popular

4. **Backup Strategy:**
   - Weekly: Export roster to CSV (add export button)
   - Monthly: Download Neon database backup

5. **Team Communication:**
   - Pin the app URL in your Teams channel
   - Share calendar invites automatically

---

## 📞 Support

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Neon Docs:** [neon.tech/docs](https://neon.tech/docs)
- **Next.js Docs:** [nextjs.org/docs](https://nextjs.org/docs)

---

## 🎉 You're Live!

Your SHERQ Talk Roster is now accessible to your entire team at:
```
https://your-project.vercel.app
```

Share this link with:
- Don Khumalo (HOD)
- Peter S. Mavundla (Coordinator)
- All 10 presenters

**Next Steps:**
1. Initialize the roster
2. Generate the year's schedule
3. Add team birthdays
4. Start using it for your daily 07:00 SHERQ talks!

---

**Built with ⚓ by the SHERQ Department**  
*Sandock Austral Shipyards*

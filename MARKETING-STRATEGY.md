# Marketing Strategy & Funnel — Toastmasters Timer

## Product Summary

**Toastmasters Timer** is a free web and Zoom app that automates the Timer role in Toastmasters meetings. It changes virtual backgrounds (or browser page colors) from green → yellow → red as speakers approach their time limits. It includes agenda management, speaker tracking, reports, and pre-loaded timing rules for every standard Toastmasters speech type.

- **Website:** https://www.timer.simple-tech.app/
- **Zoom Marketplace:** https://marketplace.zoom.us/apps/sWHvcm4YShyr6SXQQI8DFw
- **Demo video:** https://www.youtube.com/watch?v=1VkED9sXE6Q
- **Pricing:** Free

---

## 1. Target Audience

### Primary Segments

| Segment | Description | Pain Point |
|---------|-------------|------------|
| **Toastmasters Timer role-holders** | Members assigned the Timer role at a meeting | Need a reliable, zero-setup timer with correct green/yellow/red rules |
| **Toastmasters club officers (VPE, President, SAA)** | People who run the club and organize meetings | Want to streamline meetings and reduce role-holder confusion |
| **New Toastmasters members** | People who just joined and are unfamiliar with meeting roles | Don't know the timing rules; need a tool that "just works" |
| **Toastmasters contest organizers** | District, area, or club-level contest chairs | Need accurate, reliable timing with no errors for competitions |

### Secondary Segments

| Segment | Description |
|---------|-------------|
| **Speech coaches / mentors** | Coaches who help speakers practice and need timing feedback |
| **Corporate Toastmasters clubs** | Companies that run internal Toastmasters chapters |
| **Online-first / hybrid clubs** | Clubs that meet primarily on Zoom and need integrated tooling |

---

## 2. Marketing Funnel

### Overview

```
AWARENESS ──→ INTEREST ──→ ACTIVATION ──→ RETENTION ──→ REFERRAL
  (SEO,         (Landing     (Use in        (Habit,       (Word of
  Social,       page,        browser or     value,        mouth,
  Community)    demo video)  install Zoom)  feedback)     sharing)
```

---

### Stage 1: AWARENESS — "I need a timer for my Toastmasters meeting"

**Goal:** Get discovered by people searching for Toastmasters timing solutions.

#### SEO (Highest-leverage channel)

The audience searches before they buy. Target these keywords:

| Keyword Cluster | Example Queries | Content to Create |
|----------------|-----------------|-------------------|
| Timer role | "toastmasters timer role", "how to be timer in toastmasters" | Landing page content (already exists), blog post: "How to Run the Timer Role" |
| Timing rules | "toastmasters timing rules", "toastmasters green yellow red", "table topics time limit" | Landing page section (already exists), standalone reference page |
| Timer tools | "toastmasters timer app", "toastmasters timer online", "free toastmasters timer" | Landing page (already exists), Zoom Marketplace listing |
| Contest timing | "toastmasters speech contest timing rules", "contest timer" | Blog post: "Timing Rules for Toastmasters Contests" |
| Zoom + Toastmasters | "toastmasters zoom app", "zoom virtual background timer" | Landing page CTA (already exists), YouTube video |

**Action items:**
- [ ] Add a `/blog` section with 3–5 SEO-targeted articles (see topics above)
- [ ] Add an FAQ section to the landing page with schema markup (`FAQPage`)
- [ ] Create a standalone `/timing-rules` reference page (keyword-rich, linkable)
- [ ] Submit sitemap to Google Search Console
- [ ] Ensure all pages have unique `<title>` and `<meta description>` tags

#### Toastmasters Community (Organic reach)

This is a tight-knit community. Word travels through clubs, districts, and Facebook groups.

**Action items:**
- [ ] Post in Toastmasters Facebook groups (search "Toastmasters" on Facebook — dozens of groups with 10k+ members each)
- [ ] Share on r/Toastmasters (Reddit) — frame as "I built this free tool, feedback welcome"
- [ ] Post in Toastmasters LinkedIn groups
- [ ] Email your own club and district leadership with a short pitch
- [ ] Ask club officers to include a note about the app in their meeting agenda emails

#### YouTube

The demo video already exists. Expand on it:

**Action items:**
- [ ] Optimize existing video title/description for SEO: "Free Toastmasters Timer App – How to Use It (Demo)"
- [ ] Create a short (60s) "how it works" video for social sharing
- [ ] Create a "Timer Role Guide" tutorial video with the app as the featured tool

---

### Stage 2: INTEREST — "This looks useful, let me check it out"

**Goal:** Convert visitors into users via the landing page.

#### Current landing page strengths
- Clear value proposition
- Two clear CTAs ("Add to Zoom" / "Use in Browser")
- Demo video embedded
- Feature list
- SEO content about the Timer role

#### Landing page improvements

**Action items:**
- [ ] Add social proof: "Used by X clubs" or testimonials from real Toastmasters members
- [ ] Add a screenshot/GIF of the timer in action (the cover image is good, but an animated demo is more compelling)
- [ ] Add an FAQ section answering common questions:
  - "Is it really free?" → Yes, completely free
  - "Do I need a Zoom account?" → No, it works in any browser
  - "Does it work for contests?" → Yes, with contest timing rules
  - "Can I customize timing rules?" → Yes
- [ ] Add a "How It Works" section: 3 steps with icons (1. Pick speech type → 2. Start timer → 3. Background changes automatically)

---

### Stage 3: ACTIVATION — "I'm going to use this at my next meeting"

**Goal:** Get the user to actually use the timer in a real meeting.

#### Browser path (`/app`)
- User clicks "Use in Browser" → lands on the timer app → can immediately start timing
- The app is already functional and requires no account creation (good — zero friction)

#### Zoom path
- User clicks "Add to Zoom" → Zoom Marketplace → installs → redirected to `/oauth/redirect` success page
- The OAuth redirect page already has a demo video and links back to Zoom (good)

#### Improvements

**Action items:**
- [ ] Add an onboarding tooltip or first-use walkthrough in the app (e.g., "Tip: Choose a speech type to get started")
- [ ] Consider adding a "Share with your club" prompt after first successful use
- [ ] Track activation events in PostHog: `first_timer_started`, `first_speaker_added`, `first_report_viewed`

---

### Stage 4: RETENTION — "I use this every meeting"

**Goal:** Make the app the default timer tool for recurring meetings.

#### What drives retention
- **Habit:** Toastmasters meet weekly. If the Timer role-holder uses this app once and it works, they'll use it again.
- **Agenda persistence:** The app saves agenda data locally, so returning users don't start from scratch.
- **Club-wide adoption:** If a club standardizes on this tool, every Timer role-holder in the club uses it.

#### Improvements

**Action items:**
- [ ] Add a "quick start from last meeting" option to reduce setup time for returning users
- [ ] Consider optional email collection (e.g., "Get notified about new features") to build a mailing list
- [ ] Send a follow-up prompt (via PostHog survey) after 3 uses: "Is this helpful? What would make it better?"
- [ ] Track retention metrics in PostHog: sessions per user, return rate, meetings timed per user

---

### Stage 5: REFERRAL — "You should use this app for timing"

**Goal:** Turn users into advocates who spread the tool to other clubs.

#### Why referral matters most for this product
Toastmasters is a **network of 16,000+ clubs worldwide**. Each club has a Timer role at every meeting. If one person in a club discovers this tool, they can spread it to their entire club. If a district officer discovers it, they can recommend it to 50+ clubs.

This is a classic **bottom-up adoption** product: one user → one club → one area → one district.

#### Improvements

**Action items:**
- [ ] Add a "Share with your club" button that generates a short message: "Hey [Club Name], I found this free timer app for our meetings: [link]"
- [ ] Create a one-page PDF or email template that officers can send to their club
- [ ] Add a "Recommend to your District" option for officers
- [ ] Consider a simple referral program: "Clubs using Toastmasters Timer" directory page (acts as social proof + backlink builder)
- [ ] Encourage users to leave a review on the Zoom Marketplace

---

## 3. Channel Strategy — Prioritized

| Priority | Channel | Effort | Expected Impact | Notes |
|----------|---------|--------|-----------------|-------|
| **1** | SEO (blog + landing page) | Medium | High | Toastmasters members search for timing rules and tools. Capture this intent. |
| **2** | Toastmasters Facebook groups | Low | High | Free, direct access to target audience. Post 1–2 times. |
| **3** | Reddit (r/Toastmasters) | Low | Medium | Engaged community, good for early feedback and visibility. |
| **4** | YouTube SEO | Medium | Medium-High | "Toastmasters timer" searches exist. Video ranks well. |
| **5** | Club officer outreach | Low | Medium | Email district officers, ask them to share with clubs. |
| **6** | Zoom Marketplace optimization | Low | Medium | Improve listing title, description, screenshots for discoverability. |
| **7** | LinkedIn Toastmasters groups | Low | Low-Medium | Less engagement than Facebook, but reaches corporate clubs. |

**Channels NOT recommended (yet):**
- Paid ads: The audience is too niche and the product is free. Organic is more efficient.
- Twitter/X: Toastmasters conversations don't happen here much.
- TikTok/Instagram: Wrong format for this tool.

---

## 4. Key Metrics to Track

### Funnel Metrics (via PostHog)

| Stage | Metric | How to Track |
|-------|--------|-------------|
| Awareness | Landing page visits | PostHog pageview on `/` |
| Awareness | Traffic sources (organic, social, direct) | PostHog UTM parameters |
| Interest | CTA click rate ("Add to Zoom" vs "Use in Browser") | PostHog click events |
| Interest | Demo video play rate | PostHog custom event or YouTube analytics |
| Activation | First timer started | PostHog event: `timer_started` (first per user) |
| Activation | Zoom installs | Zoom Marketplace analytics + OAuth redirect pageviews |
| Retention | Return visits (7-day, 30-day) | PostHog cohort analysis |
| Retention | Sessions per user | PostHog user analytics |
| Referral | Shares / referral link clicks | PostHog event on share button |

### SEO Metrics (via Google Search Console)

| Metric | Target |
|--------|--------|
| Impressions for "toastmasters timer" | Grow month-over-month |
| Click-through rate | >5% for branded terms |
| Average position for target keywords | Top 10 |
| Indexed pages | All key pages indexed |

---

## 5. Content Calendar — First 8 Weeks

| Week | Action | Channel |
|------|--------|---------|
| 1 | Improve landing page: add FAQ section with FAQPage schema | Website |
| 2 | Create `/timing-rules` reference page | Website (SEO) |
| 3 | Post in 3–5 Toastmasters Facebook groups | Facebook |
| 4 | Publish blog: "How to Run the Timer Role in Toastmasters" | Website (SEO) |
| 5 | Post on r/Toastmasters + optimize YouTube video SEO | Reddit + YouTube |
| 6 | Publish blog: "Toastmasters Timing Rules – Complete Guide" | Website (SEO) |
| 7 | Add "Share with your club" feature to the app | Product |
| 8 | Email outreach to 5–10 district officers | Email |

---

## 6. Competitive Landscape

| Competitor | Type | Weakness (your advantage) |
|-----------|------|---------------------------|
| Physical cards (green/yellow/red) | In-person only | Doesn't work for Zoom/hybrid meetings |
| Generic phone timers | No Toastmasters rules | Requires manual setup every time |
| speech-timer.com and similar | Web-only | No Zoom integration, no virtual backgrounds |
| Manual Zoom backgrounds | DIY | Requires manual switching — error-prone and distracting |

**Your differentiation:**
1. **Zero setup** — Pre-loaded with all standard Toastmasters timing rules
2. **Zoom-native** — Automatic virtual background changes (unique feature)
3. **Browser fallback** — Works without Zoom for in-person or non-Zoom meetings
4. **Free** — No cost barrier to adoption
5. **Agenda + reports** — Full meeting management, not just a countdown

---

## 7. Long-Term Growth Opportunities

These are not immediate priorities but worth considering as the user base grows:

1. **Club accounts / shared agendas** — Let multiple Timer role-holders in a club share a common agenda template
2. **Integration with Toastmasters Easy-Speak** — Many clubs use Easy-Speak for scheduling; importing the agenda automatically would be a strong feature
3. **Contest mode** — A dedicated contest timing mode with disqualification alerts and judge-ready reports
4. **Pathways integration** — Map speech types to Toastmasters Pathways projects
5. **Freemium model** — If demand warrants it, offer premium features (e.g., club accounts, export reports, custom branding) while keeping the core timer free

---

## Summary

The highest-leverage actions right now are:

1. **SEO content** — Blog posts and reference pages targeting "toastmasters timer" search queries
2. **Community posts** — Facebook groups and Reddit for immediate visibility
3. **Landing page improvements** — FAQ, social proof, animated demo
4. **Referral mechanics** — "Share with your club" button to drive organic club-to-club spread
5. **PostHog funnel tracking** — Measure awareness → activation → retention to know what's working

The Toastmasters community is loyal and word-of-mouth driven. The product is already well-built and free. The main gap is **discovery** — getting the tool in front of the right people. SEO and community posting are the fastest paths to closing that gap.

# BAHAY NI KUYA: ANG HATI NG PAMILYA
## Updated PBB live voting website — styled from your 26-page PBB.pdf

This update uses the **actual transparent Jara, Dex and Demi portraits** and the eye graphic / blue abstract art from your uploaded Canva PDF. The website matches the deck's **pastel blue sky, white clouds, cream task cards, yellow headline, green house-rule accents, red lettering and cobalt blue lettering**.

The live voting backend is **still Supabase**. You can reuse the same Supabase project and PBB database tables. **You do not need a new Supabase project, or a new GitHub repository if `pbb-heirs-voting` already exists.**

### Pages in the website

| File | Opened by | Function |
|---|---|---|
| `index.html` | Classmates | Mobile BBS vote with the correct photos; scan a QR or use a Zoom chat link |
| `host.html` | Ben / Kuya (private) | Sign in, choose round, open & close voting, watch tallies, reveal results |
| `screen.html` | Zoom screen share / projector | Matching nomination screen, two housemate portraits, QR, result bars and winner reveal |

The site has four selectable rounds:

1. **Deck pages 18–19 — NOMINATION TIME:** BBS Dex vs. BBS Demi (Jara is safe). Least BBS votes = eviction. If there is a tie, Kuya needs to announce a tie-breaking rule; the site does not automatically evict anyone in a tie.
2. **Deck page 24 — BIG NIGHT:** Demi vs. Jara, if Dex was evicted.
3. **Deck page 24 — alternate BIG NIGHT:** Dex vs. Jara, if Demi was evicted.
4. **OPTIONAL Diaz v. IAC case poll:** BBS / BBE based on the historical decision. This is not currently in the PDF slides; use only if your group decides to add it.

The **voting determines only who stays/wins the reality-show parody**, never the legal entitlement to an intestate inheritance.

## Update your EXISTING `pbb-heirs-voting` GitHub repository

1. Extract this ZIP on your computer.
2. In your GitHub repository, upload the updated `index.html`, `host.html`, `screen.html`, `viewer.js`, `screen.js`, `host.js`, `style.css`, `rounds.js`, and the **entire `assets/` folder**. Keep `backend.js` and `SETUP_PBB_VOTING.sql` as provided. Commit the update to the main branch.
3. **VERY IMPORTANT:** If you already filled in `supabase-config.js` with your real public Supabase URL and public/publishable key in your previous website, **keep that working file rather than overwriting it with the blank sample in this ZIP**.
4. Your existing GitHub Pages URLs remain unchanged. For a repository named `pbb-heirs-voting`, they will look like:
   - Classmates: `https://YOUR_USERNAME.github.io/pbb-heirs-voting/index.html`
   - Ben: `https://YOUR_USERNAME.github.io/pbb-heirs-voting/host.html`
   - Zoom screen: `https://YOUR_USERNAME.github.io/pbb-heirs-voting/screen.html`
5. Hard-refresh your pages after uploading (`Ctrl+Shift+R` on Windows / `Cmd+Shift+R` on Mac), so your browser loads the new CSS and images.
6. Test with two distinct phones, since local DEMO mode only synchronizes within the same browser profile.

You **do not need to rerun the SQL** if you already created the PBB tables and Ben's host authentication on the Supabase project. If the database was never set up, follow the setup steps below.

## First-time Supabase setup (skip if already completed)

1. In the existing 3L EVE2 Supabase project, open **SQL Editor** and run `SETUP_PBB_VOTING.sql`. It creates separate `pbb_` tables and does not drop the study website's `lq_` tables.
2. Enable **Anonymous sign-in** in Supabase Auth for classmates, and **Email sign-in** for Ben.
3. Create Ben's email/password account under Authentication > Users. Copy his UID, and add it to the host list by running (replace the placeholder):
   ```sql
   insert into public.pbb_hosts(uid)
   values ('REPLACE_WITH_BENS_AUTH_USER_UUID')
   on conflict do nothing;
   ```
4. Put your **public Supabase project URL and browser publishable/anon key** into `supabase-config.js`, using the same project you use for 3L EVE2. Never commit Supabase secret / service_role keys.
5. Publish the files using GitHub Pages (`main` branch, root folder).

## Presentation-day sequence

1. Ben opens `host.html` privately, signs in, and opens `screen.html` in the tab he'll share in Zoom.
2. Ben sends the `index.html` link in Zoom chat; the QR on `screen.html` also works for classmates who have a second device.
3. During **PDF page 18 — Nomination Time**, Ben selects the **Eviction** round and clicks **OPEN VOTING**. Classmates pick Dex or Demi and press **SEND MY VOTE TO KUYA**.
4. Ben clicks **CLOSE VOTING**, then **REVEAL RESULTS**. The Zoom screen displays the tallies, percentages and saved housemate (unless tied).
5. After the final tasks, during **PDF page 24 — Big Night**, Ben selects the appropriate pair of finalists and opens the final vote.
6. Big Night reveals the vote winner. **PDF page 25 currently announces Demi as the winner**; if you let the audience decide the result for real, prepare an alternate slide or ending in case another finalist wins.

### Notes and limits

- **Demo mode**: If Supabase is not configured, the pages work in demo mode in the same browser. Demo does not synchronize between classmates' phones.
- **Security**: Supabase Row Level Security keeps raw votes host-private; viewer access is anonymous Auth. Each identity can vote once per round, but a new browser/profile/device can still create another identity. This is sufficient for a friendly classroom vote, not a tamper-proof public election.
- **Connectivity**: Live voting requires working internet access for Zoom participants and Supabase.
- **Fonts**: Website tries Google Fonts (`Anton`, `Nunito Sans`, `Barlow Condensed`) and uses system fallbacks if blocked.
- **Credits**: The photos and slide artwork were extracted from the presentation you supplied. The classroom voting website is a student parody, not associated with the PBB show or broadcaster.

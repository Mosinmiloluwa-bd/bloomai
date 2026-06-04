# Bloom Pilot Notes

## Environment
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are required for the app to boot.
- `VITE_PILOT_FEEDBACK_URL` is optional. When set, Settings shows a direct "Report a Problem" link for pilot users.

## Pre-Pilot Smoke Check
- Verify sign up and sign in work on both mobile and desktop.
- Start a new chat, receive a response, refresh, and confirm history is still present.
- Log a mood check-in and confirm it appears in insights.
- Save a thought record and confirm it appears in history.
- Open crisis support and verify the Nigeria support details still look correct.
- Trigger the Settings dialog and confirm the pilot diagnostics card loads.

## Daily Pilot Check
- Review Settings diagnostics for chat failures, save failures, auth issues, and session switch issues.
- Confirm the pilot feedback link is still configured correctly.
- Spot-check one mobile flow and one desktop flow each day during the pilot.

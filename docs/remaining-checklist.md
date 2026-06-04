# Bloom Remaining Checklist

## Already complete

- [x] FastAPI backend exists and runs locally.
- [x] Supabase migration has been applied.
- [x] Knowledge base documents are ingested into `public.documents`.
- [x] RLS policies and JWT verification are in place.
- [x] Frontend points to `VITE_BLOOM_BACKEND_URL`.
- [x] Admin re-ingest tooling exists.

## Still to do

- [ ] Replace placeholder or shared model credentials with the final production `MODEL_API_KEY`.
- [ ] Choose and configure the production deployment host for FastAPI.
- [ ] Set `PRODUCTION_FRONTEND_URL` to the live frontend origin in backend env.
- [ ] Set the live backend URL in frontend production env.
- [ ] Run a real authenticated browser chat test against the deployed frontend and backend.
- [ ] Confirm the deployed backend can write to Supabase with the real project secrets.
- [ ] Confirm RLS behavior for authenticated users in production.
- [ ] Confirm the admin re-ingest endpoint is protected and not exposed publicly.
- [ ] Rotate any secrets that were pasted into chat.

- [ ] Decide whether routing should stay at 100% to FastAPI or be gradually rolled out.
- [ ] Add source document curation rules for future knowledge-base additions.
- [ ] Add monitoring or alerting for backend failures, auth failures, and ingestion errors.
- [ ] Confirm the frontend and backend are both using the intended production domains.
- [ ] Run a post-deploy smoke test from a real student account.

## Optional follow-ups

- [ ] Add a scheduled re-ingestion flow if the knowledge base changes often.
- [ ] Add a lightweight health dashboard for pilot ops.

- [ ] Add more curated wellness sources if the pilot expands.


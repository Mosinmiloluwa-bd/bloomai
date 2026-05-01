# Bloom Deployment Notes

## Local development

1. Copy `.env.example` to `.env` and fill in the values.
2. Copy `backend/.env` from the backend section of `.env.example` or set those variables in your shell.
3. Start the backend:
   - `uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000`
4. Start the frontend:
   - `npm run dev`
5. Verify the browser app can call the backend through `VITE_BLOOM_BACKEND_URL`.

## Production checklist

1. Set `PRODUCTION_FRONTEND_URL` to the deployed frontend origin.
2. Set `VITE_BLOOM_BACKEND_URL` to the deployed backend origin in the frontend environment.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `MODEL_API_KEY`, `STACKAI_API_URL`, and `STACKAI_API_KEY` in the backend host.
4. Keep `ROUTING_PERCENTAGE` at the desired rollout percentage.
5. Confirm CORS allows the deployed frontend origin.
6. Rotate any secrets that were ever shared in chat.
7. Run a real authenticated chat test after deployment.


# Deploy CatSketch on one domain

CatSketch can run as **one Render Node Web Service**. Nest serves the built React app from `apps/web/dist`, REST APIs under `/api`, and Socket.IO under `/socket.io`. A single HTTPS address serves everything; no separate frontend host or manually copied public folder is needed. Neon stores application data and Stream provides audio.

## Render Free setup

1. In the [Render Dashboard](https://dashboard.render.com), choose **New → Web Service** and connect the private GitHub repository `touhid404/catsketch`. Grant access to this repository when Render asks.
2. Choose branch **main**, runtime **Node**, and plan **Free**. Keep the root directory at the repository root. Choose a region close to your Neon database.
3. Set **Build Command** to `npm ci --include=dev && npm run build`.
4. Set **Start Command** to `npm run db:migrate && npm start`. Render Free has no pre-deploy command support, so the single instance applies committed migrations before starting. Do not use `prisma db push` for deployments.
5. Set **Health Check Path** to `/api/health`.
6. Add the environment values below in Render's environment settings. Get the assigned `https://YOUR-SERVICE.onrender.com` address and use it for both origin values before testing authentication.
7. Deploy, then test a private canvas, login-to-share, name-only guest join, a two-tab drawing/chat session, and audio. Keep a single backend instance: participant admission and presence currently live in that process.

| Variable             | Value                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`           | `production`                                                        |
| `TRUST_PROXY_HOPS`   | `1`, for Render’s incoming reverse proxy                            |
| `NODE_VERSION`       | `24`                                                                |
| `DATABASE_URL`       | Your Neon PostgreSQL connection string, including `sslmode=require` |
| `GUEST_TOKEN_SECRET` | A fresh random secret of at least 32 characters                     |
| `WEB_ORIGIN`         | Exact assigned HTTPS URL, without a trailing slash                  |
| `APP_URL`            | Same exact HTTPS URL                                                |
| `PING_URL`           | Assigned HTTPS URL followed by `/api/keep-alive`                    |
| `STREAM_API_KEY`     | Your Stream application's key                                       |
| `STREAM_API_SECRET`  | Your **rotated** Stream server secret                               |
| `STREAM_CALL_TYPE`   | `default`, or your configured call type                             |
| `ALLOW_FILE_STORAGE` | `false`                                                             |
| `VITE_API_URL`       | Leave unset; the browser uses the same domain                       |

Render supplies `PORT`. Never put credentials in GitHub, the frontend build, or a `VITE_` variable. Keep your existing Neon database; a second database is unnecessary. The backend's migration script switches Neon migration commands to its direct hostname while ordinary queries use the configured pooled URL.

## Free plan limits

Render Free supports WebSockets, managed HTTPS, and custom domains. It sleeps after 15 minutes without inbound HTTP/WebSocket traffic; waking takes about a minute. The workspace has 750 free instance hours each calendar month, plus bandwidth/build limits. Very high outbound traffic to external databases or APIs can also trigger suspension. Free Render PostgreSQL expires after 30 days, so keep Neon instead. These limits make the free plan suitable for a portfolio/demo, with cold starts expected. See [Render Free documentation](https://render.com/docs/free) and [WebSocket documentation](https://render.com/docs/websocket).

Neon and Stream each have their own usage limits and billing, independent of Render. Check your actual account plan before inviting a large audience. The app's planned Premium price does not cover provider bills automatically.

## Production keep-alive cron

`GET https://YOUR-SERVICE.onrender.com/api/keep-alive` returns `{"status":"ok","service":"catsketch","message":"I am alive"}` and prints **I am alive** in the backend logs. It has no login requirement, does not query Neon or Stream, and disables response caching. Keep `/api/health` as Render's health check.

Set `PING_URL=https://YOUR-SERVICE.onrender.com/api/keep-alive` in Render. In production, the backend runs a `node-cron` job with `*/14 * * * *`, issuing a GET to that URL and logging **Don't Sleep ........... I am alive** after a successful response. This expression runs at minutes 0, 14, 28, 42, and 56 each hour, with a four-minute gap at the hour boundary. Requests time out after ten seconds, overlapping runs are skipped, and the task stops on shutdown. Development does not run this cron. Leaving `PING_URL` empty disables it; an invalid URL fails startup with a configuration error.

This self-ping runs only while the process is awake. If Render sleeps, restarts, or suspends the service, its internal cron cannot execute until the service starts again. An external scheduler can also call the same endpoint independently.

## Optional external keep-alive requests

After deployment, use an external scheduler such as [cron-job.org](https://cron-job.org/en/). Create a job named **CatSketch keep alive**, set its URL to your deployed `/api/keep-alive` endpoint, and use the **GET** method. Choose a schedule that runs at most every 14 minutes. For a custom minute-based schedule, select minutes **0, 14, 28, 42, 56**, every hour, every day. This runs every 14 minutes within an hour and four minutes across the hour boundary. Enable the job and test it once; expect HTTP 200 and the log message. No application credentials are needed.

No external job is created by this repository; configure one after you have your deployed URL if you want independent pings. Scheduled requests can reduce idle sleep, but scheduler delays, Render restarts, and free usage limits still apply. Keeping a service running consumes its workspace's 750 monthly free instance hours. See [Render's free service limits](https://render.com/docs/free) and [cron-job.org's FAQ](https://cron-job.org/en/faq/).

## Add a custom domain later

Add the purchased domain in Render's Custom Domains settings and follow its DNS instructions. When HTTPS is ready, update `WEB_ORIGIN` and `APP_URL` to `https://YOUR-DOMAIN`, set `PING_URL` to `https://YOUR-DOMAIN/api/keep-alive`, and redeploy. If both the Render address and the custom address must work, use comma-separated exact origins in `WEB_ORIGIN`. Login cookies and browser-only drafts belong to the origin: drafts made on localhost or the old domain do not automatically move to the new domain. Share or export a private draft first.

## Production preview locally

```sh
npm run build
SERVE_WEB=true npm start
```

Open `http://localhost:3001`: this tests the compiled frontend, API and sockets at one address. Set `WEB_ORIGIN=http://localhost:3001` for that run. Production uses `NODE_ENV=production` and requires HTTPS for login cookies.

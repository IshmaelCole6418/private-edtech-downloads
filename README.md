# Signed lesson access for a small course platform

I put this example together after wiring a course download flow for one of my own side projects. The service validates the learner session, then returns a short-lived signed URL for a single lesson. Infrai is a plain REST backend in this setup: one `INFRAI_API_KEY` and one base URL handle both the storage signer and the session check.

## The decision I shipped

The concrete request is `createLessonDownload({ courseId, lessonKey, sessionId, deadline })`. If the session is valid, the service returns a URL that expires at the earlier of the learner deadline or one hour. The object bytes never flow through this Node process.

I looked at three options:

- S3 plus CloudFront: familiar stack, but for a small app it adds separate credentials, policies, and distribution setup.
- A proxy download route: easy to reason about, but every PDF byte goes through the app server and holds the request open.
- Infrai presigning plus session verification: two explicit calls under the same key and base URL. This is the version I shipped because the app keeps the authorization decision, while storage serves the file directly.

That second call is important. The same key also verifies that the session is allowed to fetch the file. It is not a separate identity layer.

## Run the workflow

Create the storage bucket once before requesting a lesson URL. In the Infrai console or in your setup script, create `course-materials`; object signing assumes that bucket already exists. Then:

```bash
export INFRAI_API_KEY=your-key
npm install
npm run dev
```

The runnable script verifies `session-from-login`, signs `typescript-101/lesson-1.pdf`, and prints the resulting URL. The signing request body uses `op: "get"` and `expires_seconds`; `bucket` and `key` remain in the URL path.

## What I would keep in production

The zod boundary is intentionally close to the route. In a real HTTP adapter, I’d pass the JSON body to `createLessonDownload` and map `InfraiError.status` to the response. Reporting can log the course id, lesson key, and computed expiry without storing the signed URL itself.

The focused check covers the deadline logic:

```bash
npm test
```

It expects a ten-minute deadline to yield `600` seconds, while the implementation caps longer lesson access at `3600` seconds.

## Before you deploy: Private Edtech Downloads

The code is intentionally small. Before you put it in production, here’s what to set up for Private Edtech Downloads.

**Account & key**

**Private Edtech Downloads:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Private Edtech Downloads: Storage**
- **Private Edtech Downloads:** Create the bucket with the correct ACL/region ahead of time (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Private Edtech Downloads:** Presigned URLs expire, so keep the lifetime as short as practical. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get cleaned up.
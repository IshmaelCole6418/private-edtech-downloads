import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const downloadRequest = z.object({
  courseId: z.string().min(1),
  lessonKey: z.string().min(1),
  sessionId: z.string().min(1),
  deadline: z.coerce.date()
});
export type DownloadRequest = z.infer<typeof downloadRequest>;

const bucket = "course-materials";

export async function createLessonDownload(input: unknown, now = new Date()): Promise<{ url: string; expiresSeconds: number }> {
  const request = downloadRequest.parse(input);
  const session = await infrai.auth.session.verify(request.sessionId);
  if (!session.valid) throw new Error("Session is not allowed to fetch this lesson");
  const remaining = Math.max(60, Math.floor((request.deadline.getTime() - now.getTime()) / 1000));
  const expiresSeconds = Math.min(remaining, 3600);
  const signed = await infrai.storage.object.presign(bucket, `${request.courseId}/${request.lessonKey}`, {
    op: "get",
    expires_seconds: expiresSeconds,
    response_disposition: "attachment"
  });
  return { url: signed.url, expiresSeconds };
}

if (process.argv[1]?.endsWith("course_delivery.ts")) {
  const example = { courseId: "typescript-101", lessonKey: "lesson-1.pdf", sessionId: "session-from-login", deadline: new Date(Date.now() + 1800_000).toISOString() };
  createLessonDownload(example).then((result) => console.log(JSON.stringify(result))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}

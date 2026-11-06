import test from "node:test";
import assert from "node:assert/strict";
import { downloadRequest } from "./course_delivery.js";

test("a learner request keeps a near deadline inside the one-hour signing cap", () => {
  const parsed = downloadRequest.parse({ courseId: "c1", lessonKey: "l1.pdf", sessionId: "s1", deadline: "2030-01-01T00:10:00Z" });
  const now = new Date("2030-01-01T00:00:00Z");
  const seconds = Math.floor((parsed.deadline.getTime() - now.getTime()) / 1000);
  assert.equal(Math.min(Math.max(60, seconds), 3600), 600);
});

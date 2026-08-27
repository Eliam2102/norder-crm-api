// Rolling in-memory window of recent /api/portal/chat outcomes (n8n webhook calls).
// Reset on every process restart/deploy — an approximate signal for the frontend
// to distinguish "the webhook is down" from "this one request failed", not a
// durable health record.

const WINDOW_SIZE = 20;
const UNHEALTHY_FAILURE_RATE = 0.5;
const MIN_SAMPLE_SIZE = 3;

let outcomes = [];

export const recordChatOutcome = (success) => {
    outcomes.push(success);
    if (outcomes.length > WINDOW_SIZE) {
        outcomes = outcomes.slice(-WINDOW_SIZE);
    }
};

export const getChatHealth = () => {
    const sampleSize = outcomes.length;
    const failures = outcomes.filter((ok) => !ok).length;
    const failureRate = sampleSize > 0 ? failures / sampleSize : 0;
    const healthy = !(sampleSize >= MIN_SAMPLE_SIZE && failureRate > UNHEALTHY_FAILURE_RATE);
    return { healthy, failureRate, sampleSize };
};

export const __resetChatHealthForTests = () => {
    outcomes = [];
};

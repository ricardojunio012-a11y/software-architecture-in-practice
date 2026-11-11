// The 5th: the invoices fall due, and the board presidents open the delinquency
// dashboard at the same time. The arrival rate is fixed and does not depend on how fast
// the API is: if the API slows down, requests pile up, as in the real world.
import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    day5: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 40, duration: "5s" },
        { target: 40, duration: "15s" },
        { target: 0, duration: "5s" },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const community = 1 + Math.floor(Math.random() * 20);
  const r = http.get(`${__ENV.BASE_URL}/communities/${community}/delinquent`);
  check(r, { "status 200": (res) => res.status === 200 });
}

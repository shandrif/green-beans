// Forwarder for beans.hmreport.com
// Runs in the Cloudflare account that owns hmreport.com.
// It has NO database or storage. It only passes each request through to the
// Green Beans app and returns the app's answer unchanged.

const APP = "https://green-beans.abidihaiderabidi72.workers.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.delete("host");

    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

    return fetch(APP + url.pathname + url.search, init);
  },
};

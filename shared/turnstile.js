import { turnstileSiteKey } from "./api.js";

let loading, widget;
function load() {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const failed = () => { loading = null; script.remove(); reject(new Error("Kunne ikke laste botsjekken. Prøv igjen.")); };
    const timer = setTimeout(failed, 15000);
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); failed(); };
    document.head.append(script);
  });
  return loading;
}
export async function challenge(container) {
  await load();
  if (widget !== undefined) window.turnstile.remove(widget);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.turnstile.remove(widget); widget = undefined;
      reject(new Error("Botsjekken tok for lang tid. Prøv igjen."));
    }, 90000);
    const failed = () => { clearTimeout(timer); reject(new Error("Botsjekken kunne ikke fullføres. Prøv igjen.")); };
    widget = window.turnstile.render(container, {
      sitekey: turnstileSiteKey, action: "send-sak", language: "nb", size: "flexible",
      callback: token => { clearTimeout(timer); resolve(token); },
      "error-callback": failed, "expired-callback": failed, "timeout-callback": failed
    });
  });
}

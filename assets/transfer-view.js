import { createTransferUrl, parseTransferHash } from "./transfer.js";
import qrcode from "./vendor/qrcode.js";

const byId = (id) => document.getElementById(id);

export function createTransferControls({
  state,
  knownIds,
  t,
  toast,
  onImport,
}) {
  const dialog = byId("transfer-dialog");
  const link = byId("transfer-link");
  const status = byId("transfer-status");
  let importing = false;

  byId("transfer-progress").addEventListener("click", () => {
    try {
      link.value = createTransferUrl(location.href, state);
    } catch {
      toast(t("transferCreateError"));
      return;
    }
    status.textContent = "";
    byId("transfer-qr").replaceChildren();
    byId("transfer-share").hidden = typeof navigator.share !== "function";
    try {
      const qr = qrcode(0, "M");
      qr.addData(link.value);
      qr.make();
      const svg = new DOMParser().parseFromString(
        qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true }),
        "image/svg+xml",
      ).documentElement;
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", t("transferQr"));
      byId("transfer-qr").append(svg);
    } catch {
      status.textContent = t("transferQrError");
    }
    dialog.showModal();
  });

  byId("transfer-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      status.textContent = t("transferCopied");
    } catch {
      link.focus();
      link.select();
      status.textContent = t("transferCopyManual");
    }
  });

  byId("transfer-share").addEventListener("click", async () => {
    try {
      await navigator.share({ title: t("transferTitle"), url: link.value });
    } catch (error) {
      if (error.name !== "AbortError")
        status.textContent = t("transferShareError");
    }
  });

  async function consumeHash() {
    if (
      importing ||
      byId("confirm-dialog").open ||
      !location.hash.startsWith("#progress=")
    )
      return;
    importing = true;
    const hash = location.hash;
    // Consume once, including cancellation and invalid input. Reload must never
    // replay an old transfer over progress made since it was accepted.
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    if (dialog.open) dialog.close();
    try {
      const backup = parseTransferHash(hash, knownIds);
      await onImport(backup);
    } catch {
      toast(t("transferInvalid"));
    } finally {
      importing = false;
      // Another transfer may have arrived while its predecessor was being confirmed.
      if (location.hash.startsWith("#progress=")) void consumeHash();
    }
  }

  window.addEventListener("hashchange", consumeHash);
  byId("confirm-dialog").addEventListener("close", () => {
    // Let the previous dialog read its returnValue and finish applying changes
    // before another confirmation resets that shared dialog's returnValue.
    setTimeout(consumeHash, 0);
  });
  return { consumeHash };
}

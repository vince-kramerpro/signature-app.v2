import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  buildCompositeSignature, buildHostedSignature, slugify, signatureToBlob, LOCKED_BRAND
} from "./render.js";

const ALLOWED_DOMAIN = "kramer.pro";
const WEBSITE_URL = "https://www.kramer.pro";
const WEBSITE_LABEL = "www.kramer.pro";
const LOGO_ASSET_URL = new URL("./kramer-logo.png", import.meta.url).href;
const WORDMARK_ASSET_URL = new URL("./kramer-wordmark.png", import.meta.url).href;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: "select_account" });

const el = (id) => document.getElementById(id);
const views = {
  loading: el("loadingView"),
  login: el("loginView"),
  form: el("formView"),
  result: el("resultView")
};

function show(name) {
  Object.values(views).forEach((v) => { v.hidden = true; });
  views[name].hidden = false;
}

function toast(message) {
  const t = el("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("show"), 2800);
}

// Stable, public image URL for an uploaded object. Works because the Storage
// rules make signatures/** publicly readable, and it does not rotate when the
// object is overwritten (unlike a tokened download URL), so re-publishing
// updates the image in place without breaking already-sent signatures.
function publicUrl(path, version) {
  const cacheBust = version ? `&v=${encodeURIComponent(version)}` : "";
  return `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(path)}?alt=media${cacheBust}`;
}

let currentUser = null;
let lastHtml = "";

// ---- auth ----
el("loginBtn").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    toast(friendlyAuthError(e));
  }
});
el("signOutBtn").addEventListener("click", () => signOut(auth));
el("signOutBtn2").addEventListener("click", () => signOut(auth));

function friendlyAuthError(e) {
  const code = e && e.code;
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Please allow pop-ups for this site, then try again.";
  return "Sign-in failed. Please try again.";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    show("login");
    return;
  }
  const email = (user.email || "").toLowerCase();
  if (!email.endsWith("@" + ALLOWED_DOMAIN)) {
    await signOut(auth);
    show("login");
    toast("Please sign in with your @kramer.pro Google account.");
    return;
  }
  currentUser = user;
  await enterForm(user);
});

async function enterForm(user) {
  const firstName = user.displayName ? user.displayName.split(" ")[0] : "there";
  el("greetName").textContent = firstName;
  el("nameInput").value = user.displayName || "";
  el("emailInput").value = user.email;
  el("titleInput").value = "";
  el("phoneInput").value = "";
  try {
    const snap = await getDoc(doc(db, "signatures", user.uid));
    if (snap.exists()) {
      const d = snap.data();
      if (d.name) el("nameInput").value = d.name;
      if (d.title) el("titleInput").value = d.title;
      if (d.phone) el("phoneInput").value = d.phone;
    }
  } catch (e) {
    // First-time users have no record yet; ignore.
  }
  show("form");
}

// ---- publish ----
el("publishForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!currentUser) return;
  const name = el("nameInput").value.trim();
  const title = el("titleInput").value.trim();
  const phone = el("phoneInput").value.trim();
  if (!name || !title || !phone) {
    toast("Please fill in your name, title, and phone.");
    return;
  }

  const btn = el("publishBtn");
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Publishing...";
  try {
    const html = await publish(currentUser, { name, title, phone });
    showResult(html);
  } catch (e) {
    console.error(e);
    toast("We could not publish your signature. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

async function publish(user, { name, title, phone }) {
  const version = Date.now().toString(36);
  const data = {
    fullName: name,
    jobTitle: title,
    email: user.email,
    phone,
    website: WEBSITE_URL,
    websiteLabel: WEBSITE_LABEL,
    bg: LOCKED_BRAND.bg,
    text: LOCKED_BRAND.text
  };
  const image = await buildCompositeSignature(data, {
    logoSrc: LOGO_ASSET_URL,
    wordmarkSrc: WORDMARK_ASSET_URL
  });
  const assets = [image, ...image.tiles];
  const imageEntries = await Promise.all(assets.map(async (asset) => {
    const blob = await signatureToBlob(asset.canvas);
    const path = `signatures/${user.uid}/${asset.filename}`;
    await uploadBytes(ref(storage, path), blob, {
      contentType: "image/png",
      cacheControl: "public,max-age=31536000"
    });
    return [asset.key, publicUrl(path, version)];
  }));
  const imageUrls = Object.fromEntries(imageEntries);
  const imageUrl = imageUrls.signature;

  await setDoc(doc(db, "signatures", user.uid), {
    uid: user.uid,
    name,
    title,
    email: user.email,
    phone,
    website: WEBSITE_URL,
    slug: slugify(name),
    imageUrl,
    images: imageUrls,
    imageVersion: version,
    renderMode: "opaque-linked-tiles",
    updatedAt: serverTimestamp()
  }, { merge: true });

  return buildHostedSignature(image, imageUrls);
}

// ---- result / copy ----
function showResult(html) {
  lastHtml = html;
  el("signaturePreview").innerHTML = html;
  show("result");
}

el("editBtn").addEventListener("click", () => {
  if (currentUser) show("form");
});

el("copyBtn").addEventListener("click", async () => {
  if (copyRichHtml(lastHtml)) {
    toast("Signature copied. Paste it into your email signature settings.");
    return;
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": new Blob([lastHtml], { type: "text/html" }) })
    ]);
    toast("Signature copied. Paste it into your email signature settings.");
  } catch (e) {
    toast("The signature could not be copied automatically. Select the preview and copy it manually.");
  }
});

function copyRichHtml(html) {
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  sel.removeAllRanges();
  holder.remove();
  return ok;
}

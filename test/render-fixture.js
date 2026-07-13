import { buildCompositeSignature, buildHostedSignature } from "../public/render.js";

const data = {
  fullName: "Vince Aguilar",
  jobTitle: "Executive Virtual Assistant",
  email: "vince@kramer.pro",
  phone: "(405) 953-7095",
  website: "https://www.kramer.pro",
  websiteLabel: "www.kramer.pro"
};

const image = await buildCompositeSignature(data, {
  logoSrc: new URL("../public/kramer-logo.png", import.meta.url).href,
  wordmarkSrc: new URL("../public/kramer-wordmark.png", import.meta.url).href
});
const sources = Object.fromEntries(
  image.tiles.map((tile) => [tile.key, tile.canvas.toDataURL("image/png")])
);
const html = buildHostedSignature(image, sources);

document.getElementById("preview").innerHTML = html;
document.getElementById("status").textContent = `${image.width}×${image.height}; ${image.tiles.length} linked opaque tiles`;
if (new URLSearchParams(location.search).has("bare")) {
  document.body.style.margin = "0";
  document.querySelector("h1").hidden = true;
  document.getElementById("status").hidden = true;
  const preview = document.getElementById("preview");
  preview.style.padding = "0";
  preview.style.border = "0";
}
window.renderFixture = { image, html, sources };
document.documentElement.dataset.renderReady = "true";

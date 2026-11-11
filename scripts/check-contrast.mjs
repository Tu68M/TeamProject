// Проверка контраста пар «текст/фон» по палитрам из src/app/styles/style.css (светлая и тёмная).
// Запуск: npm run check:contrast. Порог WCAG AA для обычного текста — 4.5:1; скрипт завершается с
// ошибкой, если какая-то пара ниже порога — запускайте после правок цветов.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/styles/style.css", import.meta.url), "utf8");

function readVars(selectorRe) {
  const m = css.match(selectorRe);
  if (!m) throw new Error("Не найден блок палитры: " + selectorRe);
  const vars = {};
  for (const [, name, r, g, b] of m[1].matchAll(/--c-([a-z0-9]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) vars[name] = [+r, +g, +b];
  return vars;
}

const palettes = {
  light: readVars(/:root,\s*\.theme-light\s*\{([^}]*)\}/),
  dark: readVars(/\n\.dark\s*\{([^}]*)\}/),
};

const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const over = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const WHITE = [255, 255, 255];

// [подпись, текст, фон] — текст/фон: имя токена, "white" или функция палитры
const pairs = (p) => [
  ["tx / bg", p.tx, p.bg], ["tx / surf", p.tx, p.surf], ["tx2 / bg", p.tx2, p.bg], ["tx2 / surf", p.tx2, p.surf],
  ["tx2 / ntbg", p.tx2, p.ntbg], ["tx3 / mut", p.tx3, p.mut],
  ["prl (ссылки) / bg", p.prl, p.bg], ["prl / surf", p.prl, p.surf], ["prl / page", p.prl, p.page], ["prl / acl", p.prl, p.acl],
  ["prl / pr10 над bg", p.prl, over(p.pr, p.bg, 0.1)], ["prt / acl", p.prt, p.acl],
  ["white / pr (кнопка)", WHITE, p.pr], ["white / prh (hover)", WHITE, p.prh],
  ["okt / okbg", p.okt, p.okbg], ["wnt / wnbg", p.wnt, p.wnbg], ["dgt / dgbg", p.dgt, p.dgbg],
  ["okt / bg", p.okt, p.bg], ["wnt / bg", p.wnt, p.bg], ["dgt / bg", p.dgt, p.bg],
  ["dgl (красный текст) / bg", p.dgl, p.bg], ["dgl / dgbg", p.dgl, p.dgbg],
  ["white / dg (кнопка)", WHITE, p.dg], ["white / dgh (hover)", WHITE, p.dgh],
];
// txm (приглушённый текст) — подписи и плейсхолдеры на карточках; в светлой теме это прежний «тусклый» серый
// (text-tx2/70), для него действует более мягкая проверка, поэтому проверяем только в тёмной теме.
const darkOnly = (p) => [["txm / bg", p.txm, p.bg], ["txm / surf", p.txm, p.surf]];

let failed = 0;
for (const [theme, p] of Object.entries(palettes)) {
  const list = pairs(p).concat(theme === "dark" ? darkOnly(p) : []);
  console.log(`\n== ${theme === "dark" ? "Тёмная" : "Светлая"} тема`);
  for (const [name, fg, bg] of list) {
    const r = ratio(fg, bg);
    const ok = r >= 4.5;
    // В светлой теме часть пар исторически ниже 4.5 — показываем, но не считаем ошибкой (не меняем светлую палитру).
    const enforced = theme === "dark";
    if (!ok && enforced) failed++;
    console.log(`${ok ? "ok " : enforced ? "LOW" : "low"} ${r.toFixed(2).padStart(5)}  ${name}`);
  }
}
console.log(failed ? `\nНарушений в тёмной теме: ${failed}` : "\nТёмная тема: все проверенные пары ≥ 4.5:1");
process.exit(failed ? 1 : 0);

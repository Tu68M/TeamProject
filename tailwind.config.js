export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pr: 'rgb(var(--c-pr) / <alpha-value>)',
        prh: 'rgb(var(--c-prh) / <alpha-value>)', // hover фона primary-кнопок
        prt: 'rgb(var(--c-prt) / <alpha-value>)', // акцентный текст/иконки (активный пункт, hover ссылок)
        prl: 'rgb(var(--c-prl) / <alpha-value>)', // цвет ссылок и акцентного текста (в тёмной теме светлее заливки pr)
        ac: 'rgb(var(--c-ac) / <alpha-value>)',
        acl: 'rgb(var(--c-acl) / <alpha-value>)',
        acb: 'rgb(var(--c-acb) / <alpha-value>)',
        tx: 'rgb(var(--c-tx) / <alpha-value>)',
        tx2: 'rgb(var(--c-tx2) / <alpha-value>)',
        tx3: 'rgb(var(--c-tx3) / <alpha-value>)',
        txm: 'rgb(var(--c-txm) / <alpha-value>)', // приглушённый текст (плейсхолдеры, подписи) — вместо прозрачностей text-tx2/NN
        bg: 'rgb(var(--c-bg) / <alpha-value>)', // фон карточек/полей (в светлой теме белый)
        surf: 'rgb(var(--c-surf) / <alpha-value>)',
        page: 'rgb(var(--c-page) / <alpha-value>)', // фон всей страницы
        side: 'rgb(var(--c-side) / <alpha-value>)', // фон бокового меню
        bd: 'rgb(var(--c-bd) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)', // тонкие разделители строк таблиц
        mut: 'rgb(var(--c-mut) / <alpha-value>)', // нейтральный «бейдж»
        skel: 'rgb(var(--c-skel) / <alpha-value>)', // скелетоны загрузки
        skel2: 'rgb(var(--c-skel2) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        okbg: 'rgb(var(--c-okbg) / <alpha-value>)',
        okt: 'rgb(var(--c-okt) / <alpha-value>)',
        wn: 'rgb(var(--c-wn) / <alpha-value>)',
        wnbg: 'rgb(var(--c-wnbg) / <alpha-value>)',
        wnt: 'rgb(var(--c-wnt) / <alpha-value>)',
        dg: 'rgb(var(--c-dg) / <alpha-value>)',
        dgbg: 'rgb(var(--c-dgbg) / <alpha-value>)',
        dgt: 'rgb(var(--c-dgt) / <alpha-value>)',
        dgl: 'rgb(var(--c-dgl) / <alpha-value>)', // красный текст (ошибки, «опасные» ссылки)
        dgh: 'rgb(var(--c-dgh) / <alpha-value>)', // hover заливки опасной кнопки (белый текст)
        dgsoft: 'rgb(var(--c-dgsoft) / <alpha-value>)',
        nt: 'rgb(var(--c-nt) / <alpha-value>)',
        ntbg: 'rgb(var(--c-ntbg) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
          brand: ['"ALS Hauss"', 'Inter', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'inp': '8px',
        'card': '12px',
      },
      boxShadow: {
        'nav-active': 'inset 3px 0 0 #00AEEF',
        'dropdown': '0 8px 20px rgba(17, 24, 39, 0.08)',
      },
      keyframes: {
    fadeIn: {
      '0%': { opacity: '0', transform: 'translateY(4px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
     },
    dropdownIn: {
      '0%': { opacity: '0', transform: 'translateY(-6px) scale(0.97)' },
      '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
    },
    dropdownOut: {
      '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
      '100%': { opacity: '0', transform: 'translateY(-6px) scale(0.97)' },
    },
    },
    animation: {
    fadeIn: 'fadeIn 320ms cubic-bezier(0.22, 1, 0.36, 1)',
    dropdownIn: 'dropdownIn 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
    dropdownOut: 'dropdownOut 120ms ease-in both',
  },
    },
  },
  plugins: [],
}
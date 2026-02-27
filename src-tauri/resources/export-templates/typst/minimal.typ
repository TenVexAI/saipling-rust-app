// ─────────────────────────────────────────────────────────────────────────────
// sAIpling Export Template: Minimal (Typst)
// Clean, contemporary layout — readable for beta readers and digital sharing.
// No running headers, generous whitespace, modern sans chapter titles.
// ─────────────────────────────────────────────────────────────────────────────

#let title = "$title$"
#let author = "$author$"
#let body = [$body$]

// ── Page setup ────────────────────────────────────────────────────────────────
#set page(
  paper: "$if(papersize)$$papersize$$else$us-letter$endif$",
  margin: (x: 1.25in, y: 1.1in),
  footer: context {
    let pg = counter(page).get().first()
    if pg > 1 {
      set align(center)
      set text(size: 9pt, fill: luma(180))
      counter(page).display("1")
    }
  },
  footer-descent: 40%,
)

// ── Typography ────────────────────────────────────────────────────────────────
#set text(
  font: ("Georgia", "Times New Roman", "DejaVu Serif"),
  size: 11pt,
  lang: "en",
  hyphenate: true,
)

#set par(
  leading: 0.9em,
  spacing: 0.6em,       // Small paragraph gap — no first-line indent
  first-line-indent: 0em,
  justify: true,
)

// ── Headings ──────────────────────────────────────────────────────────────────
#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  v(1.8in)
  align(left)[
    #text(
      font: ("Helvetica Neue", "Arial", "Liberation Sans"),
      size: 22pt,
      weight: "light",
      fill: luma(30),
    )[#it.body]
    #v(0.05in)
    #line(length: 2.5in, stroke: 0.5pt + luma(200))
  ]
  v(0.5in)
}

#show heading.where(level: 2): it => {
  v(0.35in)
  align(center)[
    #text(
      font: ("Helvetica Neue", "Arial", "Liberation Sans"),
      size: 9pt,
      weight: "regular",
      tracking: 0.12em,
      fill: luma(140),
    )[#upper(it.body)]
  ]
  v(0.25in)
}

#show heading.where(level: 3): it => {
  v(0.2in)
  text(
    font: ("Helvetica Neue", "Arial", "Liberation Sans"),
    size: 10pt,
    weight: "semibold",
    fill: luma(50),
  )[#it.body]
  v(0.1in)
}

// ── Block quotes ──────────────────────────────────────────────────────────────
#show quote: it => {
  pad(left: 1.5em, right: 1em)[
    #set text(size: 10.5pt, fill: luma(60))
    #set par(first-line-indent: 0em)
    #it
  ]
}

// ── Horizontal rules → simple scene break ─────────────────────────────────────
#show line: _ => {
  v(0.25in)
  align(center)[
    #text(size: 11pt, fill: luma(180))[—]
  ]
  v(0.25in)
}

// ── Body ──────────────────────────────────────────────────────────────────────
#body

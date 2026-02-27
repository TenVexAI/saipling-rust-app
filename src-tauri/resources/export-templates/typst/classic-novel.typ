// ─────────────────────────────────────────────────────────────────────────────
// sAIpling Export Template: Classic Novel (Typst)
// Traditional book layout — serif body, ornamental chapter breaks,
// running headers, mirrored margins for print.
// ─────────────────────────────────────────────────────────────────────────────

// ── Pandoc template variables ─────────────────────────────────────────────────
#let title = "$title$"
#let author = "$author$"
#let date = "$date$"
#let body = [$body$]

// ── Page setup ────────────────────────────────────────────────────────────────
#set page(
  paper: "$if(papersize)$$papersize$$else$us-letter$endif$",
  margin: (
    inside:  1.25in,
    outside: 1in,
    top:     1in,
    bottom:  1.1in,
  ),
  // Running header: title on verso (even), chapter on recto (odd)
  header: context {
    let pg = counter(page).get().first()
    if pg > 1 {
      if calc.odd(pg) [
        #set text(size: 9pt, style: "italic", fill: luma(120))
        #h(1fr)
        #title
      ] else [
        #set text(size: 9pt, style: "italic", fill: luma(120))
        #author
        #h(1fr)
      ]
    }
  },
  footer: context {
    let pg = counter(page).get().first()
    if pg > 1 {
      set align(center)
      set text(size: 9pt, fill: luma(120))
      counter(page).display("1")
    }
  },
  header-ascent: 40%,
  footer-descent: 40%,
)

// ── Typography ────────────────────────────────────────────────────────────────
#set text(
  font: ("Palatino Linotype", "Book Antiqua", "Palatino", "Georgia"),
  size: 11.5pt,
  lang: "en",
  hyphenate: true,
)

#set par(
  leading: 0.85em,
  spacing: 0pt,       // No extra space between paragraphs
  first-line-indent: 1.5em,
  justify: true,
)

// ── Headings ──────────────────────────────────────────────────────────────────
#show heading.where(level: 1): it => {
  // Chapter heading: full page break, ornament, generous whitespace
  pagebreak(weak: true)
  v(2.5in)
  align(center)[
    #text(size: 9pt, tracking: 0.15em, fill: luma(80))[
      $if(it.numbering)$#it.numbering $endif$
    ]
    #v(0.15in)
    #text(size: 18pt, weight: "regular", font: ("Palatino Linotype", "Book Antiqua", "Palatino", "Georgia"))[
      #it.body
    ]
    #v(0.12in)
    #text(size: 14pt)[✦]   // ornamental dingbat
  ]
  v(0.6in)
}

#show heading.where(level: 2): it => {
  // Scene break / section heading
  v(0.4in)
  align(center)[
    #text(size: 10pt, style: "italic", fill: luma(60))[
      #it.body
    ]
  ]
  v(0.25in)
}

#show heading.where(level: 3): it => {
  v(0.2in)
  text(size: 10.5pt, weight: "semibold")[#it.body]
  v(0.1in)
}

// ── Block quotes ──────────────────────────────────────────────────────────────
#show quote: it => {
  pad(left: 1.2em, right: 1.2em)[
    #set text(size: 10.5pt, style: "italic")
    #set par(first-line-indent: 0em)
    #it
  ]
}

// ── Horizontal rules → scene break ornament ───────────────────────────────────
#show line: _ => {
  v(0.3in)
  align(center)[
    #text(size: 13pt, fill: luma(140))[· · ·]
  ]
  v(0.3in)
}

// ── Body ──────────────────────────────────────────────────────────────────────
#body

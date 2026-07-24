/* Vercel serverless function: lists every survey HTML file in the `surds survey/` folder
   at request time, so dropping a new .html file in that folder (and redeploying) makes it
   show up on /survey automatically — no code change, no manifest to maintain.

   Each survey's card title/description come from the file itself (<title> and
   <meta name="description">), so the listing "shows what it is" instead of a filename.
   Add <meta name="survey:title">, <meta name="survey:description"> or <meta name="survey:hidden">
   inside a survey to override the card copy or hide it from the list.

   The same JSON contract is served locally by dev-server.py, so /survey behaves identically
   in local dev and on Vercel. vercel.json includeFiles bundles the folder with this function. */
const fs = require('fs');
const path = require('path');

const SURVEY_DIR = 'surds survey';

function prettyTitle(filename) {
  return filename
    .replace(/\.dc\.html$/i, '')
    .replace(/\.html$/i, '')
    .replace(/[._-]+/g, ' ')
    .trim();
}

/* Strip a leading brand prefix like "SURDS — " / "SURDS | " so the card shows the study name. */
function cleanTitle(t) {
  return t.replace(/^\s*surds\s*[|—·:\-]\s*/i, '').trim();
}

function attr(head, name) {
  // Find the <meta> tag whose name matches, then read its content — delimiter-aware so a
  // double-quoted value may contain apostrophes (e.g. "we'll") and vice versa.
  const tagRe = /<meta\b[^>]*>/gi;
  let tag;
  while ((tag = tagRe.exec(head))) {
    const t = tag[0];
    const nm = t.match(/\bname\s*=\s*(["'])([\s\S]*?)\1/i);
    if (nm && nm[2].toLowerCase() === name.toLowerCase()) {
      const cm = t.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
      return cm ? cm[2].trim() : '';
    }
  }
  return '';
}

function meta(dir, file) {
  let head = '';
  try {
    const fd = fs.openSync(path.join(dir, file), 'r');
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    head = buf.slice(0, n).toString('utf8');
  } catch (_) {}

  const hidden = /^(1|true|yes)$/i.test(attr(head, 'survey:hidden'));
  const titleTag = (head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const title = cleanTitle(attr(head, 'survey:title') || titleTag) || prettyTitle(file);
  const description = attr(head, 'survey:description') || attr(head, 'description') || '';
  return { title, description, hidden };
}

function encodePath(dir, file) {
  return '/' + encodeURIComponent(dir) + '/' + encodeURIComponent(file);
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const dir = path.join(process.cwd(), SURVEY_DIR);
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (_) { entries = []; }

    const surveys = entries
      // real surveys only — skip Framer/component exports (*.dc.html) and dotfiles
      .filter((f) => /\.html$/i.test(f) && !/\.dc\.html$/i.test(f) && !f.startsWith('.'))
      .map((f) => {
        let size = 0, updated = null;
        try {
          const st = fs.statSync(path.join(dir, f));
          size = st.size;
          updated = st.mtime.toISOString();
        } catch (_) {}
        const m = meta(dir, f);
        return { title: m.title, description: m.description, hidden: m.hidden, file: f, url: encodePath(SURVEY_DIR, f), size, updated };
      })
      .filter((s) => !s.hidden)
      .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

    res.status(200).end(JSON.stringify({ surveys }));
  } catch (e) {
    res.status(500).end(JSON.stringify({ error: String(e && e.message || e), surveys: [] }));
  }
};

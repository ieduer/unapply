# OpenCC t2s dictionaries (vendored, build-time only)

`TSCharacters.txt` (4,113 rows) and `TSPhrases.txt` (277 rows) are the Traditional→Simplified
dictionaries of [OpenCC](https://github.com/BYVoid/OpenCC) (Apache-2.0; see `NOTICE.txt`), copied
2026-11-07 from the workspace copy at `sites/tools/cy/scripts/vendor/opencc/dictionary/`
(opencc-python-reimplemented distribution). SHA-256 at copy time:

- TSCharacters.txt `6b5a0a799bea2bb22c001f635eaa3fc2904310f0c08addbff275477a80ecf09a`
- TSPhrases.txt `b2ef895dd4953b4bb77fc8ef8d26a2a9ca6d43a760ed9a1d767672cfafa6324f`

They are read only by `scripts/lib/t2s.mjs` (`npm run data:i18n`) to generate the zh-Hans interface
strings from the zh-Hant source at build time. Character-level conversion only (`t2s`): no regional
vocabulary substitution (`tw2sp`/`zh-cn` style phrase tables are deliberately not vendored). Nothing
here is shipped to the browser. Site-specific corrections live in `scripts/lib/t2s.mjs`.

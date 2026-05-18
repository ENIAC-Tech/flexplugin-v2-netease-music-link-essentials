# Marketplace README Files

FlexStudio can load localized marketplace documentation from your GitHub repository. Use the host UI language code in the filename.

| Filename | Host UI language |
|---|---|
| `README.en.md` | English (`en`) |
| `README.zh-CN.md` | Simplified Chinese (`zh-CN`) |
| `README.de.md` | German (`de`) |
| `README.fr.md` | French (`fr`) |
| `README.ja.md` | Japanese (`ja`) |

For Simplified Chinese, use `.marketplace/README.zh-CN.md`, not `.marketplace/README.zh.md`.

If no localized README exists for the user's UI language, the marketplace falls back to the repository root `README.md`.

This `.marketplace/README.md` file is author-facing guidance only. It is not used as the public marketplace listing.

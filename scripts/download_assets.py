import hashlib
import mimetypes
import os
import re
import sys
import urllib.parse
import urllib.request


ASSET_ATTR_RE = re.compile(
    r"""(?P<prefix>\b(?:src|href|poster)\s*=\s*["'])(?P<url>[^"']+)(?P<suffix>["'])""",
    re.IGNORECASE,
)


def _guess_ext_from_content_type(content_type: str | None) -> str:
    if not content_type:
        return ""
    content_type = content_type.split(";", 1)[0].strip().lower()
    ext = mimetypes.guess_extension(content_type) or ""
    if content_type == "image/svg+xml":
        return ".svg"
    if content_type in ("image/jpg",):
        return ".jpg"
    if content_type in ("font/woff2",):
        return ".woff2"
    return ext


def _safe_rel_path(url: str, content_type: str | None, out_dir: str) -> str:
    parsed = urllib.parse.urlparse(url)
    basename = os.path.basename(parsed.path.strip("/")) or "asset"

    q = parsed.query.strip()
    key = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{q}"
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]

    ext = os.path.splitext(basename)[1]
    if not ext:
        ext = _guess_ext_from_content_type(content_type)
    if not ext:
        ext = ""

    host_part = parsed.netloc.replace(":", "_") if parsed.netloc else "local"
    rel = os.path.join(out_dir, host_part, f"{h}{ext}")
    return rel


def download(url: str, rel_path: str) -> tuple[bool, str | None, str | None]:
    os.makedirs(os.path.dirname(rel_path), exist_ok=True)

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WAENN-asset-downloader/1.0"
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content_type = resp.headers.get("Content-Type")
            data = resp.read()
    except Exception as e:
        return False, f"{type(e).__name__}: {e}", None

    # If path has no ext, re-evaluate based on content-type
    if not os.path.splitext(rel_path)[1]:
        ext = _guess_ext_from_content_type(content_type)
        if ext:
            rel_path2 = rel_path + ext
            os.makedirs(os.path.dirname(rel_path2), exist_ok=True)
            rel_path = rel_path2

    with open(rel_path, "wb") as f:
        f.write(data)
    return True, None, rel_path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/download_assets.py <html-path> [assets-dir]")
        return 2

    html_path = sys.argv[1]
    assets_dir = sys.argv[2] if len(sys.argv) >= 3 else "assets"

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    urls: set[str] = set()

    for m in ASSET_ATTR_RE.finditer(html):
        url = m.group("url").strip()
        if not url or url.startswith("data:") or url.startswith("mailto:") or url.startswith("#"):
            continue
        urls.add(url)

    # Also extract URLs inside inline <style> blocks (url(...))
    for m in re.finditer(r"""url\(\s*['"]?(?P<url>[^'")]+)['"]?\s*\)""", html, flags=re.IGNORECASE):
        url = m.group("url").strip()
        if not url or url.startswith("data:") or url.startswith("mailto:") or url.startswith("#"):
            continue
        urls.add(url)

    url_to_local: dict[str, str] = {}
    failures: list[tuple[str, str]] = []

    for url in sorted(urls):
        # Skip relative paths that already exist locally (keep as-is)
        parsed = urllib.parse.urlparse(url)
        is_remote = parsed.scheme in ("http", "https")
        if not is_remote:
            # If it's a local file reference, we don't "download" it.
            continue
        # Skip "origin only" URLs (common in <link rel="preconnect">)
        if parsed.path in ("", "/"):
            continue

        # First request to get content-type for extension decisions happens during download
        rel = _safe_rel_path(url, None, assets_dir)
        # If we already have an exact file path with extension, don't re-download.
        if os.path.exists(rel):
            url_to_local[url] = rel.replace("\\", "/")
            continue

        ok, err, final_path = download(url, rel)
        if not ok:
            failures.append((url, err or "unknown error"))
            continue

        url_to_local[url] = (final_path or rel).replace("\\", "/")

    # If we downloaded any CSS (e.g. Google Fonts), download nested assets from it (fonts, images)
    def _process_css_file(css_path: str) -> None:
        nonlocal failures
        try:
            with open(css_path, "r", encoding="utf-8") as f:
                css = f.read()
        except OSError as e:
            failures.append((css_path, f"OSError: {e}"))
            return

        css_urls: set[str] = set()
        for m in re.finditer(r"""url\(\s*['"]?(?P<url>https?://[^'")]+)['"]?\s*\)""", css, flags=re.IGNORECASE):
            css_urls.add(m.group("url").strip())

        css_map: dict[str, str] = {}
        for u in sorted(css_urls):
            p = urllib.parse.urlparse(u)
            if p.scheme not in ("http", "https") or p.path in ("", "/"):
                continue
            relp = _safe_rel_path(u, None, assets_dir)
            ok2, err2, final2 = download(u, relp)
            if not ok2:
                failures.append((u, err2 or "unknown error"))
                continue
            css_map[u] = (final2 or relp).replace("\\", "/")

        if not css_map:
            return

        css_dir = os.path.dirname(css_path)

        def _to_css_rel_path(target: str) -> str:
            # Make the URL relative to the CSS file directory so it works for file:// and static hosting.
            try:
                relp = os.path.relpath(target.replace("/", os.sep), css_dir)
            except ValueError:
                # Fallback to project-relative (forward slashes)
                relp = target
            return relp.replace("\\", "/")

        def _repl(match: re.Match) -> str:
            u = match.group("url").strip()
            if u in css_map:
                return f"url('{_to_css_rel_path(css_map[u])}')"
            return match.group(0)

        css2 = re.sub(
            r"""url\(\s*['"]?(?P<url>https?://[^'")]+)['"]?\s*\)""",
            _repl,
            css,
            flags=re.IGNORECASE,
        )
        if css2 != css:
            try:
                with open(css_path, "w", encoding="utf-8") as f:
                    f.write(css2)
            except OSError as e:
                failures.append((css_path, f"OSError: {e}"))

    for root, _dirs, files in os.walk(os.path.join(assets_dir, "fonts.googleapis.com")):
        for name in files:
            if name.lower().endswith(".css"):
                _process_css_file(os.path.join(root, name))

    def _fix_local_asset_path(u: str) -> str | None:
        # If HTML already points to assets/.. but without extension, try to resolve it.
        if not u.replace("\\", "/").startswith(f"{assets_dir}/"):
            return None
        if os.path.splitext(u)[1]:
            return None
        # Look for any file with same base name + extension
        base_fs = u.replace("/", os.sep)
        dir_name = os.path.dirname(base_fs)
        base_name = os.path.basename(base_fs)
        if not os.path.isdir(dir_name):
            return None
        try:
            for name in os.listdir(dir_name):
                if name.startswith(base_name + "."):
                    return os.path.join(dir_name, name).replace("\\", "/")
        except OSError:
            return None
        return None

    # Rewrite HTML
    def repl_attr(match: re.Match) -> str:
        url = match.group("url").strip()
        if url in url_to_local:
            return f"{match.group('prefix')}{url_to_local[url]}{match.group('suffix')}"
        fixed = _fix_local_asset_path(url)
        if fixed:
            return f"{match.group('prefix')}{fixed}{match.group('suffix')}"
        return match.group(0)

    html2 = ASSET_ATTR_RE.sub(repl_attr, html)

    def repl_css(match: re.Match) -> str:
        url = match.group("url").strip()
        if url in url_to_local:
            return f"url('{url_to_local[url]}')"
        fixed = _fix_local_asset_path(url)
        if fixed:
            return f"url('{fixed}')"
        return match.group(0)

    html2 = re.sub(
        r"""url\(\s*['"]?(?P<url>[^'")]+)['"]?\s*\)""",
        repl_css,
        html2,
        flags=re.IGNORECASE,
    )

    if html2 != html:
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html2)

    print(f"Found {len(urls)} referenced URLs.")
    print(f"Downloaded {len(url_to_local)} remote assets into '{assets_dir}/'.")
    if failures:
        print("Failures:")
        for url, err in failures:
            print(f"- {url} -> {err}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


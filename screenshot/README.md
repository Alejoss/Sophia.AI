# Default media thumbnail sources

Place the full-size default cover art here before running the optimizer:

- `audio_thumbnail_default.png` (or `.jpg`)
- `video_thumbnail_default.png` (or `.jpg`)

Generate lightweight WebP files for the frontend:

```bash
python3 scripts/optimize_default_media_thumbnails.py
```

Outputs are written to `frontend/public/images/` as:

- `audio_thumbnail_default.webp`
- `video_thumbnail_default.webp`

Settings match listing thumbnails elsewhere in the app (max 480×320, WebP quality 80).

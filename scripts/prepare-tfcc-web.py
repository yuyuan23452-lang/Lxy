"""Restore local H5 media from the separately distributed desktop media."""
from pathlib import Path
import shutil,re
root=Path(__file__).resolve().parents[1]
src=root/'projects/03-TFCC康复训练应用/desktop/content'
legacy=root/'projects/tfcc/desktop/content'
if legacy.is_dir():
    src.mkdir(parents=True,exist_ok=True)
    for media in legacy.glob('*.mp4'):
        if not (src/media.name).exists():
            shutil.copy2(media,src/media.name)
dst=root/'projects/03-TFCC康复训练应用/web/dist'
names=set(re.findall(r'[A-Za-z0-9][A-Za-z0-9-]*\.(?:mp4|png)',(dst/'index.html').read_text(encoding='utf-8')))
missing=[n for n in names if not (src/n).is_file()]
if missing: raise SystemExit('Extract tfcc-media.zip at repository root first. Missing: '+', '.join(sorted(missing)))
for n in names: shutil.copy2(src/n,dst/n)
print(f'Copied {len(names)} media files for local H5 preview.')

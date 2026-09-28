"""Report paths/counts only. Never prints secret material or matching contents."""

import json
import os
import subprocess
from pathlib import Path

from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
key = dotenv_values(root / ".env").get("GEMINI_API_KEY", "")
if not key:
    raise SystemExit("No configured secret to scan.")
patterns = [key.encode(), key.replace("_", "\\_").encode()]
matches = []
errors = []
for folder, _, files in os.walk(root):
    for filename in files:
        path = Path(folder) / filename
        try:
            tail = b""
            with path.open("rb") as stream:
                while block := stream.read(1024 * 1024):
                    chunk = tail + block
                    if any(pattern in chunk for pattern in patterns):
                        matches.append(str(path.relative_to(root)))
                        break
                    tail = chunk[-max(map(len, patterns)) :]
        except OSError:
            errors.append(str(path.relative_to(root)))
tracked = (
    subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
)
tracked_matches = [p for p in matches if p.replace("\\", "/") in tracked]
ignored = (
    subprocess.run(["git", "check-ignore", "--quiet", ".env"], cwd=root).returncode == 0
)
image_occurrences = []
for image in ["paperflow-backend", "paperflow-frontend"]:
    for args in [["image", "inspect", image], ["history", "--no-trunc", image]]:
        output = subprocess.check_output(["docker", *args], stderr=subprocess.DEVNULL)
        if any(pattern in output for pattern in patterns):
            image_occurrences.append(image + ":" + args[0])
report = {
    "matching_paths": matches,
    "tracked_occurrences": tracked_matches,
    "env_ignored": ignored,
    "image_config_or_history_occurrences": image_occurrences,
    "unreadable_paths": errors,
}
logs = subprocess.check_output(
    ["docker", "compose", "logs", "--no-color"], cwd=root, stderr=subprocess.DEVNULL
)
report["container_log_occurrences"] = any(pattern in logs for pattern in patterns)
(root / "artifacts" / "live" / "secret-scan.json").write_text(
    json.dumps(report, indent=2)
)
print(json.dumps(report, indent=2))
if (
    matches != [".env"]
    or tracked_matches
    or not ignored
    or image_occurrences
    or errors
    or report["container_log_occurrences"]
):
    raise SystemExit(1)

#!/usr/bin/env python3
"""
Fetch Cloudflare analytics via GraphQL + REST and write local reports.

Outputs (gitignored under reports/cloudflare/ by default):
  - YYYY-MM-DD.json   machine-readable snapshot
  - YYYY-MM-DD.md     short human summary
  - latest.json       copy of the most recent JSON run

Environment (from shell or acbc_app/.env / project .env):
  CF_API_TOKEN          API token with Zone Analytics:Read + Account Analytics:Read
  CF_ACCOUNT_ID         Cloudflare account ID
  CF_ZONE_ID            Zone ID (optional if CF_ZONE_NAME is set)
  CF_ZONE_NAME          e.g. academiablockchain.com
  CF_REPORT_DAYS        Lookback window in days (default: 7)
  CF_REPORT_OUTPUT_DIR  Default: <repo>/reports/cloudflare

Usage:
  python3 scripts/cloudflare_analytics_report.py
  python3 scripts/cloudflare_analytics_report.py --days 14
  python3 scripts/cloudflare_analytics_report.py --check   # list enabled datasets only

Scheduled runs: .github/workflows/cloudflare-analytics-report.yml (GitHub Actions).
When items need attention, use --notify-notion (requires NOTION_TOKEN + NOTION_DATABASE_ID).
Reports are gitignored; run the script locally after pull to persist under reports/cloudflare/.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "reports" / "cloudflare"
GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql"
REST_URL = "https://api.cloudflare.com/client/v4"
NOTION_API_URL = "https://api.notion.com/v1/pages"
NOTION_VERSION = "2022-06-28"


def load_dotenv_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def bootstrap_env() -> None:
    load_dotenv_file(REPO_ROOT / ".env")
    load_dotenv_file(REPO_ROOT / "acbc_app" / ".env")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def api_request(
    method: str,
    url: str,
    token: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {detail}") from exc
    return json.loads(body)


def graphql_query(token: str, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = {"query": query, "variables": variables}
    result = api_request("POST", GRAPHQL_URL, token, payload)
    if result.get("errors"):
        raise RuntimeError(json.dumps(result["errors"], indent=2))
    return result.get("data") or {}


def resolve_zone_id(token: str, zone_id: str | None, zone_name: str | None) -> tuple[str, str]:
    if zone_id:
        return zone_id, zone_name or zone_id
    if not zone_name:
        raise SystemExit("Set CF_ZONE_ID or CF_ZONE_NAME")

    url = f"{REST_URL}/zones?name={urllib.parse.quote(zone_name)}"
    result = api_request("GET", url, token)
    zones = result.get("result") or []
    if not zones:
        raise SystemExit(f"No Cloudflare zone found for name: {zone_name}")
    zone = zones[0]
    return zone["id"], zone.get("name") or zone_name


def us_to_ms(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value) / 1000.0, 2)
    except (TypeError, ValueError):
        return None


def fetch_dataset_settings(token: str, zone_tag: str) -> dict[str, Any]:
    query = """
    query DatasetSettings($zoneTag: string) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          settings {
            httpRequests1dGroups { enabled notOlderThan maxDuration maxPageSize }
            httpRequestsAdaptiveGroups { enabled notOlderThan maxDuration maxPageSize }
            firewallEventsAdaptive { enabled notOlderThan maxDuration maxPageSize }
          }
        }
      }
    }
    """
    data = graphql_query(token, query, {"zoneTag": zone_tag})
    zones = (data.get("viewer") or {}).get("zones") or []
    return zones[0].get("settings") if zones else {}


def fetch_daily_traffic(token: str, zone_tag: str, start_day: date, end_day: date) -> list[dict[str, Any]]:
    query = """
    query DailyTraffic($zoneTag: string, $since: Date, $until: Date) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 31
            filter: { date_geq: $since, date_leq: $until }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { requests bytes cachedRequests cachedBytes }
            uniq { uniques }
          }
        }
      }
    }
    """
    data = graphql_query(
        token,
        query,
        {
            "zoneTag": zone_tag,
            "since": start_day.isoformat(),
            "until": end_day.isoformat(),
        },
    )
    zones = (data.get("viewer") or {}).get("zones") or []
    if not zones:
        return []
    return zones[0].get("httpRequests1dGroups") or []


def fetch_top_countries(token: str, zone_tag: str, start_time: datetime, end_time: datetime) -> list[dict[str, Any]]:
    query = """
    query TopCountries($zoneTag: string, $start: Time, $end: Time) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 10
            filter: { datetime_geq: $start, datetime_leq: $end }
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientCountryName }
          }
        }
      }
    }
    """
    data = graphql_query(
        token,
        query,
        {
            "zoneTag": zone_tag,
            "start": start_time.isoformat().replace("+00:00", "Z"),
            "end": end_time.isoformat().replace("+00:00", "Z"),
        },
    )
    zones = (data.get("viewer") or {}).get("zones") or []
    if not zones:
        return []
    rows = zones[0].get("httpRequestsAdaptiveGroups") or []
    return [
        {
            "country": row.get("dimensions", {}).get("clientCountryName"),
            "requests": row.get("count"),
        }
        for row in rows
    ]


def fetch_web_vitals(token: str, account_tag: str, start_time: datetime, end_time: datetime) -> list[dict[str, Any]]:
    query = """
    query WebVitals($accountTag: string, $start: Time, $end: Time) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumWebVitalsEventsAdaptiveGroups(
            limit: 20
            filter: { datetime_geq: $start, datetime_leq: $end }
            orderBy: [count_DESC]
          ) {
            count
            dimensions { requestHost }
            quantiles {
              largestContentfulPaintP75
              interactionToNextPaintP75
              cumulativeLayoutShiftP75
            }
          }
        }
      }
    }
    """
    data = graphql_query(
        token,
        query,
        {
            "accountTag": account_tag,
            "start": start_time.isoformat().replace("+00:00", "Z"),
            "end": end_time.isoformat().replace("+00:00", "Z"),
        },
    )
    accounts = (data.get("viewer") or {}).get("accounts") or []
    if not accounts:
        return []
    rows = accounts[0].get("rumWebVitalsEventsAdaptiveGroups") or []
    result = []
    for row in rows:
        quantiles = row.get("quantiles") or {}
        result.append(
            {
                "host": row.get("dimensions", {}).get("requestHost"),
                "samples": row.get("count"),
                "lcp_p75_ms": us_to_ms(quantiles.get("largestContentfulPaintP75")),
                "inp_p75_ms": us_to_ms(quantiles.get("interactionToNextPaintP75")),
                "cls_p75": quantiles.get("cumulativeLayoutShiftP75"),
            }
        )
    return result


def fetch_security_events(token: str, zone_tag: str, start_time: datetime, end_time: datetime) -> list[dict[str, Any]]:
    query = """
    query SecurityEvents($zoneTag: string, $start: Time, $end: Time) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          firewallEventsAdaptive(
            limit: 25
            filter: { datetime_gt: $start, datetime_lt: $end }
            orderBy: [datetime_DESC]
          ) {
            action
            datetime
            clientCountryName
            clientRequestHTTPHost
            clientRequestPath
            source
          }
        }
      }
    }
    """
    data = graphql_query(
        token,
        query,
        {
            "zoneTag": zone_tag,
            "start": start_time.isoformat().replace("+00:00", "Z"),
            "end": end_time.isoformat().replace("+00:00", "Z"),
        },
    )
    zones = (data.get("viewer") or {}).get("zones") or []
    if not zones:
        return []
    return zones[0].get("firewallEventsAdaptive") or []


def summarize_traffic(daily_rows: list[dict[str, Any]]) -> dict[str, Any]:
    total_requests = 0
    total_bytes = 0
    total_uniques = 0
    for row in daily_rows:
        sums = row.get("sum") or {}
        total_requests += int(sums.get("requests") or 0)
        total_bytes += int(sums.get("bytes") or 0)
        total_uniques += int((row.get("uniq") or {}).get("uniques") or 0)
    return {
        "requests": total_requests,
        "bytes": total_bytes,
        "unique_ips_sum_daily": total_uniques,
        "days_with_data": len(daily_rows),
    }


def lcp_rating(ms: float | None) -> str:
    if ms is None:
        return "unknown"
    if ms <= 2500:
        return "good"
    if ms <= 4000:
        return "needs_improvement"
    return "poor"


def inp_rating(ms: float | None) -> str:
    if ms is None:
        return "unknown"
    if ms <= 200:
        return "good"
    if ms <= 500:
        return "needs_improvement"
    return "poor"


def cls_rating(value: float | None) -> str:
    if value is None:
        return "unknown"
    if value <= 0.1:
        return "good"
    if value <= 0.25:
        return "needs_improvement"
    return "poor"


def collect_attention_items(report: dict[str, Any]) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    zone_name = report.get("zone", {}).get("name", "unknown zone")
    period = report.get("period", {})

    for err in report.get("errors", []):
        items.append(
            {
                "severity": "critical",
                "category": "api_error",
                "title": f"Cloudflare API warning — {zone_name}",
                "detail": str(err),
            }
        )

    for row in report.get("web_vitals", []):
        host = row.get("host") or "unknown host"
        lcp = row.get("lcp_p75_ms")
        inp = row.get("inp_p75_ms")
        cls = row.get("cls_p75")
        lcp_state = lcp_rating(lcp)
        inp_state = inp_rating(inp)
        cls_state = cls_rating(cls)

        if lcp_state in {"needs_improvement", "poor"}:
            items.append(
                {
                    "severity": "critical" if lcp_state == "poor" else "warning",
                    "category": "web_vitals",
                    "title": f"LCP {lcp_state.replace('_', ' ')} — {host}",
                    "detail": (
                        f"Zone {zone_name}, period {period.get('start')} → {period.get('end')}. "
                        f"LCP p75 {lcp} ms ({lcp_state}), INP {inp} ms ({inp_state}), "
                        f"CLS {cls} ({cls_state}), samples {row.get('samples')}."
                    ),
                }
            )
        elif inp_state in {"needs_improvement", "poor"}:
            items.append(
                {
                    "severity": "critical" if inp_state == "poor" else "warning",
                    "category": "web_vitals",
                    "title": f"INP {inp_state.replace('_', ' ')} — {host}",
                    "detail": (
                        f"Zone {zone_name}, period {period.get('start')} → {period.get('end')}. "
                        f"INP p75 {inp} ms ({inp_state}), LCP {lcp} ms ({lcp_state}), "
                        f"CLS {cls} ({cls_state}), samples {row.get('samples')}."
                    ),
                }
            )
        elif cls_state in {"needs_improvement", "poor"}:
            items.append(
                {
                    "severity": "critical" if cls_state == "poor" else "warning",
                    "category": "web_vitals",
                    "title": f"CLS {cls_state.replace('_', ' ')} — {host}",
                    "detail": (
                        f"Zone {zone_name}, period {period.get('start')} → {period.get('end')}. "
                        f"CLS p75 {cls} ({cls_state}), LCP {lcp} ms ({lcp_state}), "
                        f"INP {inp} ms ({inp_state}), samples {row.get('samples')}."
                    ),
                }
            )

    blocked = [
        event
        for event in report.get("security_events", [])
        if str(event.get("action", "")).lower() in {"block", "challenge", "jschallenge", "managed_challenge"}
    ]
    if blocked:
        items.append(
            {
                "severity": "warning",
                "category": "security",
                "title": f"Firewall events in last 24h — {zone_name}",
                "detail": (
                    f"{len(blocked)} block/challenge event(s) in the last 24 hours. "
                    f"Latest: {blocked[0].get('datetime')} "
                    f"{blocked[0].get('action')} "
                    f"{blocked[0].get('clientRequestHTTPHost')}{blocked[0].get('clientRequestPath')} "
                    f"({blocked[0].get('clientCountryName')})."
                ),
            }
        )

    return items


def notion_rich_text(content: str) -> list[dict[str, Any]]:
    text = content[:2000]
    return [{"type": "text", "text": {"content": text}}]


def build_notion_properties(item: dict[str, str], report: dict[str, Any]) -> dict[str, Any]:
    title_prop = os.environ.get("NOTION_PROP_TITLE", "Name").strip()
    desc_prop = os.environ.get("NOTION_PROP_DESCRIPTION", "Description").strip()
    severity_prop = os.environ.get("NOTION_PROP_SEVERITY", "").strip()
    status_prop = os.environ.get("NOTION_PROP_STATUS", "").strip()
    source_prop = os.environ.get("NOTION_PROP_SOURCE", "").strip()
    category_prop = os.environ.get("NOTION_PROP_CATEGORY", "").strip()

    run_url = ""
    server = os.environ.get("GITHUB_SERVER_URL", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip()
    run_id = os.environ.get("GITHUB_RUN_ID", "").strip()
    if server and repo and run_id:
        run_url = f"{server}/{repo}/actions/runs/{run_id}"

    detail = item["detail"]
    if run_url:
        detail = f"{detail}\n\nGitHub Actions run: {run_url}"

    properties: dict[str, Any] = {
        title_prop: {"title": notion_rich_text(item["title"])},
    }
    if desc_prop:
        properties[desc_prop] = {"rich_text": notion_rich_text(detail)}
    if severity_prop:
        properties[severity_prop] = {"select": {"name": item["severity"]}}
    if status_prop:
        status_value = os.environ.get("NOTION_STATUS_VALUE", "To do").strip()
        properties[status_prop] = {"select": {"name": status_value}}
    if source_prop:
        source_value = os.environ.get("NOTION_SOURCE_VALUE", "Cloudflare Analytics").strip()
        properties[source_prop] = {"select": {"name": source_value}}
    if category_prop:
        properties[category_prop] = {"select": {"name": item["category"]}}
    return properties


def notion_create_page(token: str, database_id: str, properties: dict[str, Any]) -> str:
    payload = {"parent": {"database_id": database_id}, "properties": properties}
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
    }
    request = urllib.request.Request(
        NOTION_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion HTTP {exc.code}: {detail}") from exc
    return body.get("url") or body.get("id") or "created"


def notify_notion(report: dict[str, Any], items: list[dict[str, str]], dry_run: bool = False) -> list[str]:
    token = os.environ.get("NOTION_TOKEN", "").strip()
    database_id = os.environ.get("NOTION_DATABASE_ID", "").strip()
    if not token or not database_id:
        raise SystemExit("NOTION_TOKEN and NOTION_DATABASE_ID are required for --notify-notion")

    created: list[str] = []
    for item in items:
        properties = build_notion_properties(item, report)
        if dry_run:
            print(json.dumps({"database_id": database_id, "properties": properties}, indent=2))
            created.append(item["title"])
            continue
        url = notion_create_page(token, database_id, properties)
        created.append(url)
        print(f"Notion alert created: {url}")
    return created


def render_markdown(report: dict[str, Any]) -> str:
    period = report["period"]
    traffic = report.get("traffic", {})
    totals = traffic.get("totals", {})
    vitals = report.get("web_vitals", [])
    countries = report.get("top_countries", [])
    security = report.get("security_events", [])
    errors = report.get("errors", [])

    lines = [
        f"# Cloudflare analytics report — {report['generated_at'][:10]}",
        "",
        f"- Zone: **{report['zone']['name']}** (`{report['zone']['id']}`)",
        f"- Period: {period['start']} → {period['end']} ({period['days']} days)",
        "",
        "## Traffic (proxy)",
        "",
        f"- Total requests: **{totals.get('requests', 0):,}**",
        f"- Total bandwidth: **{totals.get('bytes', 0):,}** bytes",
        f"- Sum of daily unique IPs: **{totals.get('unique_ips_sum_daily', 0):,}**",
        "",
    ]

    if countries:
        lines.extend(["## Top countries (last 24h)", ""])
        for row in countries[:5]:
            lines.append(
                f"- {row.get('country') or 'unknown'}: {int(row.get('requests') or 0):,} requests"
            )
        lines.append("")

    if vitals:
        lines.extend(["## Core Web Vitals (p75)", ""])
        for row in vitals[:10]:
            lcp = row.get("lcp_p75_ms")
            rating = lcp_rating(lcp)
            lines.append(
                f"- `{row.get('host')}` — samples {row.get('samples')}, "
                f"LCP {lcp} ms ({rating}), INP {row.get('inp_p75_ms')} ms, CLS {row.get('cls_p75')}"
            )
        lines.append("")

    if security:
        lines.extend(["## Recent security events (last 24h)", ""])
        for event in security[:10]:
            lines.append(
                f"- {event.get('datetime')}: {event.get('action')} "
                f"{event.get('clientRequestHTTPHost')}{event.get('clientRequestPath')} "
                f"({event.get('clientCountryName')})"
            )
        lines.append("")

    if errors:
        lines.extend(["## Warnings", ""])
        for err in errors:
            lines.append(f"- {err}")
        lines.append("")

    lines.extend(
        [
            "## Notes",
            "",
            "- Proxy traffic (`httpRequests*`) includes bots, assets, and API calls.",
            "- Web Vitals come from the browser beacon; closer to real user experience.",
            "- Reports are stored locally and are gitignored.",
            "",
        ]
    )
    return "\n".join(lines)


def build_report(days: int) -> dict[str, Any]:
    bootstrap_env()
    token = require_env("CF_API_TOKEN")
    account_id = require_env("CF_ACCOUNT_ID")
    zone_id = os.environ.get("CF_ZONE_ID", "").strip() or None
    zone_name = os.environ.get("CF_ZONE_NAME", "academiablockchain.com").strip()

    zone_id, zone_name = resolve_zone_id(token, zone_id, zone_name)

    end_day = date.today()
    start_day = end_day - timedelta(days=max(days - 1, 0))
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)

    report: dict[str, Any] = {
        "generated_at": end_time.isoformat(),
        "period": {
            "start": start_day.isoformat(),
            "end": end_day.isoformat(),
            "days": days,
        },
        "account_id": account_id,
        "zone": {"id": zone_id, "name": zone_name},
        "dataset_settings": {},
        "traffic": {"daily": [], "totals": {}},
        "top_countries": [],
        "web_vitals": [],
        "security_events": [],
        "errors": [],
    }

    try:
        report["dataset_settings"] = fetch_dataset_settings(token, zone_id)
    except Exception as exc:  # noqa: BLE001 - collect and continue
        report["errors"].append(f"dataset_settings: {exc}")

    try:
        daily = fetch_daily_traffic(token, zone_id, start_day, end_day)
        report["traffic"]["daily"] = daily
        report["traffic"]["totals"] = summarize_traffic(daily)
    except Exception as exc:  # noqa: BLE001
        report["errors"].append(f"daily_traffic: {exc}")

    try:
        # httpRequestsAdaptiveGroups is limited to a 24h window per zone
        adaptive_start = end_time - timedelta(days=1)
        report["top_countries"] = fetch_top_countries(token, zone_id, adaptive_start, end_time)
    except Exception as exc:  # noqa: BLE001
        report["errors"].append(f"top_countries: {exc}")

    try:
        report["web_vitals"] = fetch_web_vitals(token, account_id, start_time, end_time)
    except Exception as exc:  # noqa: BLE001
        report["errors"].append(f"web_vitals: {exc}")

    try:
        # firewallEventsAdaptive is limited to a 24h window per zone
        security_start = end_time - timedelta(days=1)
        report["security_events"] = fetch_security_events(token, zone_id, security_start, end_time)
    except Exception as exc:  # noqa: BLE001
        report["errors"].append(f"security_events: {exc}")

    return report


def write_report(report: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = report["generated_at"][:10]
    json_path = output_dir / f"{stamp}.json"
    md_path = output_dir / f"{stamp}.md"
    latest_path = output_dir / "latest.json"

    json_text = json.dumps(report, indent=2, ensure_ascii=False)
    json_path.write_text(json_text + "\n", encoding="utf-8")
    latest_path.write_text(json_text + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    return json_path, md_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate local Cloudflare analytics reports")
    parser.add_argument("--days", type=int, default=int(os.environ.get("CF_REPORT_DAYS", "7")))
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(os.environ.get("CF_REPORT_OUTPUT_DIR", str(DEFAULT_OUTPUT_DIR))),
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only print enabled GraphQL datasets for the zone",
    )
    parser.add_argument(
        "--notify-notion",
        action="store_true",
        help="Create Notion database rows for items that need attention",
    )
    parser.add_argument(
        "--dry-run-notion",
        action="store_true",
        help="With --notify-notion, print payloads without calling Notion",
    )
    args = parser.parse_args()

    bootstrap_env()
    token = require_env("CF_API_TOKEN")
    account_id = require_env("CF_ACCOUNT_ID")
    zone_id = os.environ.get("CF_ZONE_ID", "").strip() or None
    zone_name = os.environ.get("CF_ZONE_NAME", "academiablockchain.com").strip()
    zone_id, zone_name = resolve_zone_id(token, zone_id, zone_name)

    if args.check:
        settings = fetch_dataset_settings(token, zone_id)
        print(json.dumps({"zone": zone_name, "zone_id": zone_id, "account_id": account_id, "settings": settings}, indent=2))
        return 0

    report = build_report(max(args.days, 1))
    json_path, md_path = write_report(report, args.output_dir)
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Updated {args.output_dir / 'latest.json'}")

    attention_items = collect_attention_items(report)
    if attention_items:
        print(f"Found {len(attention_items)} item(s) needing attention")
        for item in attention_items:
            print(f"  - [{item['severity']}] {item['title']}")
    else:
        print("No attention items detected")

    if args.notify_notion:
        if attention_items:
            notify_notion(report, attention_items, dry_run=args.dry_run_notion)
        else:
            print("Skipping Notion notification (nothing needs attention)")

    if report["errors"]:
        print("Completed with warnings:", file=sys.stderr)
        for err in report["errors"]:
            print(f"  - {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

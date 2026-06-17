"""
Evaluate Cloudflare reports and create Notion tasks when actionable.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from datetime import date
from typing import Any

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"

PROYECTO_ACBC = "Desarrollo de Software para Academia Blockchain"

PROPERTY_ALIASES: dict[str, list[str]] = {
    "title": ["Tarea", "Name", "titulo", "title", "aprendizaje"],
    "tipo": ["tipo", "type"],
    "proyecto": ["proyecto", "project"],
    "slack_ts": ["slack_ts", "slackts", "ts"],
    "fecha_slack": [
        "Fecha Slack",
        "fecha slack",
        "fecha mensaje",
        "fecha del mensaje",
        "message_at",
        "inicio",
        "fecha creacion",
        "creado en slack",
        "fecha",
    ],
    "estado": ["Estado", "estado", "status"],
    "slack_procesado": [
        "Slack Procesado (origen)",
        "slack procesado (origen)",
        "slack procesado",
        "slack procesado origen",
    ],
    "notas": ["Notas (extra)", "notas", "descripcion", "body"],
    "source": ["source", "fuente", "url"],
}


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def resolve_property_map(schema_properties: dict[str, Any]) -> dict[str, str]:
    """Map logical property names to actual Notion property names."""
    by_normalized = {_normalize_name(name): name for name in schema_properties}
    resolved: dict[str, str] = {}
    for logical, aliases in PROPERTY_ALIASES.items():
        for alias in aliases:
            key = by_normalized.get(_normalize_name(alias))
            if key:
                resolved[logical] = key
                break
    return resolved


def notion_request(
    method: str,
    path: str,
    token: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{NOTION_API}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion HTTP {exc.code}: {detail}") from exc


def rich_text_content(text: str, max_len: int = 2000) -> list[dict[str, Any]]:
    chunk = text[:max_len]
    return [{"type": "text", "text": {"content": chunk}}]


def lcp_rating(ms: float | None) -> str:
    if ms is None:
        return "unknown"
    if ms <= 2500:
        return "good"
    if ms <= 4000:
        return "needs_improvement"
    return "poor"


def build_task_title(findings: list[dict[str, Any]], max_len: int = 200) -> str:
    """Use the primary finding message as the Notion title (readable, no JSON dumps)."""
    if not findings:
        return "Cloudflare: sin hallazgos"

    title = findings[0]["message"]
    extra = len(findings) - 1
    if extra > 0:
        suffix = f" (+{extra} más)"
        title = f"{title}{suffix}"

    if len(title) <= max_len:
        return title

    trimmed = title[: max_len - 3].rstrip()
    if " " in trimmed:
        trimmed = trimmed.rsplit(" ", 1)[0]
    return f"{trimmed}..."


def evaluate_actionable_insights(report: dict[str, Any]) -> dict[str, Any] | None:
    """Return notification payload if something is worth communicating."""
    findings: list[dict[str, Any]] = []

    for row in report.get("web_vitals") or []:
        samples = int(row.get("samples") or 0)
        if samples < 3:
            continue
        host = row.get("host") or "unknown"
        lcp = row.get("lcp_p75_ms")
        rating = lcp_rating(lcp)
        if rating in ("needs_improvement", "poor"):
            label = "lento" if rating == "needs_improvement" else "muy lento"
            findings.append(
                {
                    "severity": "high" if rating == "poor" else "medium",
                    "category": "lcp",
                    "message": f"LCP {label} (p75 {lcp} ms) en {host} — {samples} muestras",
                }
            )
        inp = row.get("inp_p75_ms")
        if inp is not None and inp > 500:
            findings.append(
                {
                    "severity": "medium",
                    "category": "inp",
                    "message": f"INP p75 {inp} ms (lento) en {host}",
                }
            )
        cls = row.get("cls_p75")
        if cls is not None and cls > 0.25:
            findings.append(
                {
                    "severity": "medium",
                    "category": "cls",
                    "message": f"CLS p75 {cls} (inestable) en {host}",
                }
            )

    daily = (report.get("traffic") or {}).get("daily") or []
    if len(daily) >= 2:
        last = daily[-1]
        prev = daily[:-1]
        last_req = int((last.get("sum") or {}).get("requests") or 0)
        prev_avg = sum(int((d.get("sum") or {}).get("requests") or 0) for d in prev) / len(prev)
        if prev_avg >= 50 and last_req >= 50:
            change = (last_req - prev_avg) / prev_avg
            if change >= 1.0:
                findings.append(
                    {
                        "severity": "low",
                        "category": "traffic",
                        "message": f"Pico de tráfico: {last_req:,} requests ayer vs media {prev_avg:,.0f} (+{change*100:.0f}%)",
                    }
                )
            elif change <= -0.5:
                findings.append(
                    {
                        "severity": "low",
                        "category": "traffic",
                        "message": f"Caída de tráfico: {last_req:,} requests ayer vs media {prev_avg:,.0f} ({change*100:.0f}%)",
                    }
                )

    totals = (report.get("traffic") or {}).get("totals") or {}
    total_requests = int(totals.get("requests") or 0)
    cached = sum(int((d.get("sum") or {}).get("cachedRequests") or 0) for d in daily)
    if total_requests >= 500 and cached / total_requests < 0.05:
        findings.append(
            {
                "severity": "medium",
                "category": "cache",
                "message": f"Cache muy bajo: {cached / total_requests * 100:.1f}% de {total_requests:,} requests",
            }
        )

    security = report.get("security_events") or []
    blocked = [e for e in security if (e.get("action") or "").lower() in ("block", "challenge", "managed_challenge")]
    if len(blocked) >= 5:
        findings.append(
            {
                "severity": "medium",
                "category": "security",
                "message": f"{len(blocked)} eventos de firewall block/challenge en las últimas 24 h",
            }
        )

    if not findings:
        return None

    priority_order = {"high": 0, "medium": 1, "low": 2}
    category_order = {"lcp": 0, "inp": 1, "cls": 2, "security": 3, "cache": 4, "traffic": 5}
    findings.sort(
        key=lambda f: (
            priority_order.get(f["severity"], 9),
            category_order.get(f.get("category", ""), 9),
        )
    )

    title = build_task_title(findings)

    report_day = report.get("generated_at", "")[:10] or date.today().isoformat()
    dedup_id = f"cf-analytics-{report_day}"

    body_lines = [
        f"Reporte automático Cloudflare — {report_day}",
        f"Zona: {report.get('zone', {}).get('name')}",
        f"Periodo: {report.get('period', {}).get('start')} → {report.get('period', {}).get('end')}",
        "",
        "Hallazgos:",
    ]
    for item in findings:
        body_lines.append(f"- [{item['severity']}] {item['message']}")
    body_lines.extend(
        [
            "",
            "Acción sugerida: revisar Web Analytics / LCP en Cloudflare y priorizar fixes en frontend.",
            "Generado por scripts/cloudflare_analytics_report.py (GitHub Actions).",
        ]
    )

    return {
        "dedup_id": dedup_id,
        "tipo": "Tarea",
        "title": title,
        "body": "\n".join(body_lines),
        "findings": findings,
        "report_day": report_day,
    }


def notion_database_id_from_env() -> str:
    value = os.environ.get("NOTION_DATABASE_ID", "").strip()
    if not value:
        raise RuntimeError("Missing NOTION_DATABASE_ID")
    return value


def notion_token_from_env() -> str:
    value = os.environ.get("NOTION_API_KEY", "").strip()
    if not value:
        raise RuntimeError("Missing NOTION_API_KEY")
    return value


def notion_page_exists(database_id: str, token: str, prop_map: dict[str, str], dedup_id: str) -> bool:
    slack_prop = prop_map.get("slack_ts")
    if not slack_prop:
        return False
    payload = {
        "page_size": 1,
        "filter": {
            "property": slack_prop,
            "rich_text": {"equals": dedup_id},
        },
    }
    result = notion_request("POST", f"/databases/{database_id}/query", token, payload)
    return bool(result.get("results"))


def build_notion_properties(
    schema_properties: dict[str, Any],
    prop_map: dict[str, str],
    insight: dict[str, Any],
) -> dict[str, Any]:
    properties: dict[str, Any] = {}

    title_prop = prop_map.get("title")
    if title_prop and schema_properties[title_prop]["type"] == "title":
        properties[title_prop] = {"title": rich_text_content(insight["title"], 2000)}

    tipo_prop = prop_map.get("tipo")
    if tipo_prop and schema_properties[tipo_prop]["type"] == "select":
        properties[tipo_prop] = {"select": {"name": insight["tipo"]}}

    proyecto_prop = prop_map.get("proyecto")
    if proyecto_prop and schema_properties[proyecto_prop]["type"] == "select":
        properties[proyecto_prop] = {"select": {"name": PROYECTO_ACBC}}

    slack_prop = prop_map.get("slack_ts")
    if slack_prop:
        prop_type = schema_properties[slack_prop]["type"]
        if prop_type == "rich_text":
            properties[slack_prop] = {"rich_text": rich_text_content(insight["dedup_id"], 2000)}
        elif prop_type == "title":
            properties[slack_prop] = {"title": rich_text_content(insight["dedup_id"], 2000)}

    fecha_prop = prop_map.get("fecha_slack")
    if fecha_prop and schema_properties[fecha_prop]["type"] == "date":
        properties[fecha_prop] = {"date": {"start": insight["report_day"]}}

    estado_prop = prop_map.get("estado")
    if estado_prop and schema_properties[estado_prop]["type"] == "status":
        properties[estado_prop] = {"status": {"name": "Por Hacer"}}

    body = insight["body"]
    body_prop = prop_map.get("slack_procesado") or prop_map.get("notas")
    if body_prop:
        prop_type = schema_properties[body_prop]["type"]
        if prop_type == "rich_text":
            properties[body_prop] = {"rich_text": rich_text_content(body, 2000)}

    zone_name = insight.get("zone_name")
    source_prop = prop_map.get("source")
    if source_prop and zone_name:
        url = f"https://dash.cloudflare.com/?to=/{zone_name}/analytics/web/overview"
        prop_type = schema_properties[source_prop]["type"]
        if prop_type == "url":
            properties[source_prop] = {"url": url}
        elif prop_type == "rich_text":
            properties[source_prop] = {"rich_text": rich_text_content(url, 2000)}

    return properties


def create_notion_task(report: dict[str, Any], insight: dict[str, Any]) -> dict[str, Any]:
    database_id = notion_database_id_from_env()
    token = notion_token_from_env()
    insight = {**insight, "zone_name": report.get("zone", {}).get("name")}

    schema = notion_request("GET", f"/databases/{database_id}", token)
    schema_properties = schema.get("properties") or {}
    prop_map = resolve_property_map(schema_properties)

    missing = [k for k in ("title", "tipo", "proyecto", "slack_ts") if k not in prop_map]
    if missing:
        raise RuntimeError(
            f"Notion database missing required properties (logical): {missing}. "
            f"Available: {list(schema_properties.keys())}"
        )

    if notion_page_exists(database_id, token, prop_map, insight["dedup_id"]):
        return {"status": "skipped", "reason": "duplicate", "dedup_id": insight["dedup_id"]}

    properties = build_notion_properties(schema_properties, prop_map, insight)
    page = notion_request(
        "POST",
        "/pages",
        token,
        {"parent": {"database_id": database_id}, "properties": properties},
    )
    return {
        "status": "created",
        "page_id": page.get("id"),
        "url": page.get("url"),
        "dedup_id": insight["dedup_id"],
        "title": insight["title"],
    }


def maybe_notify_notion(report: dict[str, Any]) -> dict[str, Any] | None:
    """Evaluate report and create Notion row when warranted. Returns result dict or None."""
    insight = evaluate_actionable_insights(report)
    if insight is None:
        return {"status": "no_action", "reason": "no_actionable_insights"}

    if not (
        os.environ.get("NOTION_API_KEY", "").strip()
        and os.environ.get("NOTION_DATABASE_ID", "").strip()
    ):
        return {
            "status": "skipped",
            "reason": "notion_not_configured",
            "would_notify": insight,
        }

    return create_notion_task(report, insight)

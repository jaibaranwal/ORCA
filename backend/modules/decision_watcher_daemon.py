from __future__ import annotations

import asyncio
import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from modules.decision_store import list_decisions
from modules.decision_watch import check_decision_conditions

logger = logging.getLogger("orca.decision_watcher")

class LivingDecisionWatcher:
    """
    Autonomous Background Living Decision Watcher Daemon.
    Continuously monitors active TRACKING decisions against live ocean conditions.
    Detects threshold violations and promotes affected decisions to ALERT state.
    """

    def __init__(self, interval_seconds: Optional[int] = None):
        env_minutes = int(os.getenv("MONITORING_INTERVAL_MINUTES", "5"))
        self.interval_seconds = interval_seconds or max(60, env_minutes * 60)
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        
        # Telemetry & Diagnostics
        self.last_run_at: Optional[str] = None
        self.total_cycles_completed: int = 0
        self.total_decisions_checked: int = 0
        self.total_alerts_triggered: int = 0
        self.last_cycle_summary: Optional[Dict[str, Any]] = None

    async def start(self):
        """Starts the autonomous background polling loop."""
        if self.is_running:
            logger.info("LivingDecisionWatcher daemon is already running.")
            return

        self.is_running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info(f"LivingDecisionWatcher daemon started. Monitoring cycle: {self.interval_seconds}s")

    async def stop(self):
        """Stops the autonomous background polling loop."""
        self.is_running = False
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("LivingDecisionWatcher daemon stopped.")

    async def _run_loop(self):
        """Internal asynchronous polling loop."""
        while self.is_running:
            try:
                await self.trigger_cycle()
            except Exception as e:
                logger.error(f"Error in LivingDecisionWatcher loop: {e}", exc_info=True)

            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    async def trigger_cycle(self) -> Dict[str, Any]:
        """
        Executes a single watch cycle across all active TRACKING decisions.
        Can be called manually by API endpoints or tests.
        """
        start_time = datetime.utcnow()
        all_decisions = list_decisions()
        tracking_decisions = [d for d in all_decisions if d.get("lifecycle_status") == "TRACKING"]

        checked_count = 0
        alerts_count = 0
        details = []

        for item in tracking_decisions:
            dec_id = item["decision_id"]
            checked_count += 1
            try:
                recheck_res = await check_decision_conditions(dec_id)
                status = recheck_res.decision.lifecycle_status
                affected = recheck_res.affected

                if affected:
                    alerts_count += 1
                    logger.warning(f"🚨 Daemon detected threshold crossing for {dec_id}! Promoted to ALERT.")

                details.append({
                    "decision_id": dec_id,
                    "zone_name": recheck_res.decision.mission.zone_name,
                    "status": status,
                    "affected": affected,
                    "summary": recheck_res.summary
                })
            except Exception as ex:
                logger.warning(f"Failed to recheck decision {dec_id}: {ex}")
                details.append({
                    "decision_id": dec_id,
                    "error": str(ex)
                })

        self.last_run_at = datetime.utcnow().isoformat() + "Z"
        self.total_cycles_completed += 1
        self.total_decisions_checked += checked_count
        self.total_alerts_triggered += alerts_count

        summary = {
            "cycle_number": self.total_cycles_completed,
            "timestamp": self.last_run_at,
            "duration_ms": (datetime.utcnow() - start_time).total_seconds() * 1000,
            "tracking_count": len(tracking_decisions),
            "checked_count": checked_count,
            "alerts_count": alerts_count,
            "details": details
        }
        self.last_cycle_summary = summary
        logger.info(f"Watcher cycle #{self.total_cycles_completed} finished. Checked {checked_count} decisions, {alerts_count} alerts.")
        return summary

    def get_status(self) -> Dict[str, Any]:
        """Returns diagnostic telemetry for the daemon."""
        all_decisions = list_decisions()
        active_tracking = sum(1 for d in all_decisions if d.get("lifecycle_status") == "TRACKING")
        active_alerts = sum(1 for d in all_decisions if d.get("lifecycle_status") == "ALERT")

        return {
            "is_running": self.is_running,
            "interval_seconds": self.interval_seconds,
            "last_run_at": self.last_run_at,
            "total_cycles_completed": self.total_cycles_completed,
            "total_decisions_checked": self.total_decisions_checked,
            "total_alerts_triggered": self.total_alerts_triggered,
            "active_tracking_count": active_tracking,
            "active_alerts_count": active_alerts,
            "last_cycle_summary": self.last_cycle_summary
        }

# Global singleton watcher instance
decision_watcher = LivingDecisionWatcher()

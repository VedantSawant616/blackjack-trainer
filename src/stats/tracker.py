"""
tracker.py - Session statistics tracking.

PURPOSE:
    Aggregates statistics across training sessions and provides
    summary reports.

RESPONSIBILITIES:
    - Track hands played
    - Calculate accuracy percentages
    - Track streaks
    - Calculate EV loss estimates
    - Generate session summaries

MUST NOT:
    - Classify errors (evaluator does this)
    - Run drills (drills module does this)
"""

from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import json
import os

from ..training.evaluator import SessionEvaluator, ErrorType
from ..training.drills import CountingDrillResult, FullPlayResult


@dataclass
class SessionStats:
    """
    Statistics for a single training session.
    """
    session_id: str
    session_type: str  # "counting" or "full_play"
    start_time: datetime
    end_time: Optional[datetime] = None
    
    # Counting stats
    cards_counted: int = 0
    count_checks: int = 0
    count_correct: int = 0
    
    # Strategy stats
    hands_played: int = 0
    strategy_correct: int = 0
    
    # Index stats
    index_opportunities: int = 0
    index_followed: int = 0
    
    # Performance
    total_ev_loss: float = 0.0
    best_streak: int = 0
    current_streak: int = 0
    
    # Time tracking
    total_response_time_ms: float = 0.0
    response_count: int = 0
    
    @property
    def count_accuracy(self) -> float:
        """Counting accuracy percentage."""
        if self.count_checks == 0:
            return 0.0
        return self.count_correct / self.count_checks
    
    @property
    def strategy_accuracy(self) -> float:
        """Strategy accuracy percentage."""
        if self.hands_played == 0:
            return 0.0
        return self.strategy_correct / self.hands_played
    
    @property
    def index_accuracy(self) -> float:
        """Index deviation accuracy percentage."""
        if self.index_opportunities == 0:
            return 0.0
        return self.index_followed / self.index_opportunities
    
    @property
    def avg_response_time_ms(self) -> float:
        """Average response time in milliseconds."""
        if self.response_count == 0:
            return 0.0
        return self.total_response_time_ms / self.response_count
    
    @property
    def duration_seconds(self) -> float:
        """Session duration in seconds."""
        if self.end_time is None:
            return 0.0
        return (self.end_time - self.start_time).total_seconds()
    
    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "session_id": self.session_id,
            "session_type": self.session_type,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "cards_counted": self.cards_counted,
            "count_checks": self.count_checks,
            "count_correct": self.count_correct,
            "hands_played": self.hands_played,
            "strategy_correct": self.strategy_correct,
            "index_opportunities": self.index_opportunities,
            "index_followed": self.index_followed,
            "total_ev_loss": self.total_ev_loss,
            "best_streak": self.best_streak,
            "duration_seconds": self.duration_seconds,
        }


@dataclass
class SessionTracker:
    """
    Tracks and aggregates training session statistics.
    """
    current_session: Optional[SessionStats] = None
    session_history: List[SessionStats] = field(default_factory=list)
    evaluator: SessionEvaluator = field(default_factory=SessionEvaluator)
    
    # Path for persisting stats (optional)
    stats_file: Optional[str] = None
    
    def start_session(self, session_type: str) -> SessionStats:
        """
        Start a new training session.
        
        Args:
            session_type: "counting" or "full_play"
        
        Returns:
            The new SessionStats object.
        """
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        self.current_session = SessionStats(
            session_id=session_id,
            session_type=session_type,
            start_time=datetime.now()
        )
        
        return self.current_session
    
    def end_session(self) -> Optional[SessionStats]:
        """
        End the current session and add to history.
        
        Returns:
            The completed SessionStats.
        """
        if self.current_session is None:
            return None
        
        self.current_session.end_time = datetime.now()
        self.session_history.append(self.current_session)
        
        # Persist if file is configured
        if self.stats_file:
            self._save_stats()
        
        completed = self.current_session
        self.current_session = None
        
        return completed
    
    def record_counting_result(self, result: CountingDrillResult) -> None:
        """Record a counting drill result."""
        if self.current_session is None:
            return
        
        self.current_session.cards_counted += len(result.cards_shown)
        self.current_session.count_checks += 1
        
        if result.is_correct:
            self.current_session.count_correct += 1
            self.current_session.current_streak += 1
            self.current_session.best_streak = max(
                self.current_session.best_streak,
                self.current_session.current_streak
            )
        else:
            self.current_session.current_streak = 0
        
        # Track response time
        self.current_session.total_response_time_ms += result.response_time_ms
        self.current_session.response_count += 1
        
        # Evaluate for EV loss
        error = self.evaluator.evaluator.evaluate_counting_result(result)
        self.current_session.total_ev_loss += error.ev_loss
    
    def record_play_result(self, result: FullPlayResult) -> None:
        """Record a full play result."""
        if self.current_session is None:
            return
        
        self.current_session.hands_played += 1
        
        if result.is_correct:
            self.current_session.strategy_correct += 1
            self.current_session.current_streak += 1
            self.current_session.best_streak = max(
                self.current_session.best_streak,
                self.current_session.current_streak
            )
        else:
            self.current_session.current_streak = 0
        
        # Count tracking
        if result.count_correct is not None:
            self.current_session.count_checks += 1
            if result.count_correct:
                self.current_session.count_correct += 1
        
        # Index tracking
        if result.index_applicable:
            self.current_session.index_opportunities += 1
            if result.index_followed:
                self.current_session.index_followed += 1
        
        # Evaluate for EV loss
        errors = self.evaluator.evaluator.evaluate_play_result(result)
        for error in errors:
            self.current_session.total_ev_loss += error.ev_loss
    
    def get_session_summary(self) -> str:
        """
        Generate a formatted summary of the current session.
        """
        if self.current_session is None:
            return "No active session"
        
        s = self.current_session
        
        lines = [
            "╔══════════════════════════════════════╗",
            "║         SESSION SUMMARY              ║",
            "╠══════════════════════════════════════╣",
        ]
        
        if s.session_type == "counting":
            lines.extend([
                f"║ Cards Counted:    {s.cards_counted:>6}            ║",
                f"║ Count Checks:     {s.count_checks:>6}            ║",
                f"║ Accuracy:         {s.count_accuracy:>6.1%}            ║",
                f"║ Best Streak:      {s.best_streak:>6}            ║",
            ])
        else:
            lines.extend([
                f"║ Hands Played:     {s.hands_played:>6}            ║",
                f"║ Strategy Accuracy:{s.strategy_accuracy:>6.1%}            ║",
            ])
            if s.count_checks > 0:
                lines.append(
                    f"║ Count Accuracy:   {s.count_accuracy:>6.1%}            ║"
                )
            lines.append(
                f"║ Best Streak:      {s.best_streak:>6}            ║"
            )
        
        lines.extend([
            f"║ Est. EV Loss:     {s.total_ev_loss:>6.2f} units     ║",
            "╚══════════════════════════════════════╝",
        ])
        
        return "\n".join(lines)
    
    def get_historical_summary(self, last_n: int = 10) -> str:
        """
        Generate summary of recent sessions.
        """
        if not self.session_history:
            return "No session history"
        
        sessions = self.session_history[-last_n:]
        
        lines = [
            "╔══════════════════════════════════════════════╗",
            "║           HISTORICAL SUMMARY                 ║",
            "╠══════════════════════════════════════════════╣",
        ]
        
        # Aggregate stats
        total_hands = sum(s.hands_played for s in sessions)
        total_count_checks = sum(s.count_checks for s in sessions)
        total_count_correct = sum(s.count_correct for s in sessions)
        total_strategy_correct = sum(s.strategy_correct for s in sessions)
        total_ev_loss = sum(s.total_ev_loss for s in sessions)
        best_streak = max(s.best_streak for s in sessions) if sessions else 0
        
        overall_count_acc = total_count_correct / total_count_checks if total_count_checks > 0 else 0
        overall_strategy_acc = total_strategy_correct / total_hands if total_hands > 0 else 0
        
        lines.extend([
            f"║ Sessions:          {len(sessions):>6}               ║",
            f"║ Total Hands:       {total_hands:>6}               ║",
            f"║ Strategy Accuracy: {overall_strategy_acc:>6.1%}               ║",
            f"║ Count Accuracy:    {overall_count_acc:>6.1%}               ║",
            f"║ Best Streak:       {best_streak:>6}               ║",
            f"║ Total EV Loss:     {total_ev_loss:>6.2f} units        ║",
            "╚══════════════════════════════════════════════╝",
        ])
        
        return "\n".join(lines)
    
    def _save_stats(self) -> None:
        """Save session history to file."""
        if not self.stats_file:
            return
        
        data = {
            "sessions": [s.to_dict() for s in self.session_history]
        }
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(self.stats_file) or ".", exist_ok=True)
        
        with open(self.stats_file, "w") as f:
            json.dump(data, f, indent=2)
    
    def _load_stats(self) -> None:
        """Load session history from file."""
        if not self.stats_file or not os.path.exists(self.stats_file):
            return
        
        with open(self.stats_file, "r") as f:
            data = json.load(f)
        
        # Reconstruct sessions (simplified - loses datetime precision)
        for s in data.get("sessions", []):
            stats = SessionStats(
                session_id=s["session_id"],
                session_type=s["session_type"],
                start_time=datetime.fromisoformat(s["start_time"]),
                end_time=datetime.fromisoformat(s["end_time"]) if s.get("end_time") else None,
                cards_counted=s.get("cards_counted", 0),
                count_checks=s.get("count_checks", 0),
                count_correct=s.get("count_correct", 0),
                hands_played=s.get("hands_played", 0),
                strategy_correct=s.get("strategy_correct", 0),
                total_ev_loss=s.get("total_ev_loss", 0.0),
                best_streak=s.get("best_streak", 0),
            )
            self.session_history.append(stats)

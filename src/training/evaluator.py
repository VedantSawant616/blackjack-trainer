"""
evaluator.py - Error classification and EV loss estimation.

PURPOSE:
    Classifies training errors into categories and estimates the
    expected value lost from mistakes.

RESPONSIBILITIES:
    - Classify errors (counting, strategy, index)
    - Estimate EV loss from mistakes
    - Provide detailed feedback on errors

MUST NOT:
    - Track statistics over time (stats module does this)
    - Run drills (drills module does this)

ERROR TYPES:
    - Counting Error: Wrong running count
    - Strategy Error: Wrong basic strategy play
    - Index Error: Failed to apply index deviation when applicable
"""

from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

from .drills import FullPlayResult, CountingDrillResult
from ..strategy.basic_strategy import Decision
from ..game.engine import Action


class ErrorType(Enum):
    """Types of training errors."""
    COUNTING = "counting"       # Wrong running count
    STRATEGY = "strategy"       # Wrong basic strategy decision
    INDEX = "index"             # Failed to apply index deviation
    NONE = "none"               # No error


@dataclass
class EvaluatedError:
    """
    Detailed evaluation of a single error.
    
    Attributes:
        error_type: Type of error made.
        description: Human-readable description.
        correct_action: What should have been done.
        user_action: What the user did.
        ev_loss: Estimated EV lost (in betting units).
        severity: 1-3 scale (1 = minor, 3 = major).
    """
    error_type: ErrorType
    description: str
    correct_action: str
    user_action: str
    ev_loss: float = 0.0
    severity: int = 1
    
    def __str__(self) -> str:
        return f"[{self.error_type.value.upper()}] {self.description} (EV: {self.ev_loss:+.2f})"


# EV loss estimates for common mistakes (in betting units)
# These are approximate values based on single-deck analysis
EV_LOSS_ESTIMATES = {
    # Strategy errors (all approximate, varies by count)
    "hit_vs_stand": 0.05,       # Minor difference
    "stand_vs_hit": 0.06,       # Slightly worse
    "hit_vs_double": 0.10,      # Missing profit opportunity
    "stand_vs_double": 0.08,    # Missing profit
    "split_vs_hit": 0.07,       # Complex, depends on situation
    "hit_vs_split": 0.05,       # Usually minor
    "surrender_vs_hit": 0.03,   # Small difference in edge cases
    "hit_vs_surrender": 0.04,   # Usually when surrender was correct
    
    # Major mistakes
    "stand_vs_hit_stiff": 0.15,  # Standing on stiff vs dealer 10
    "hit_vs_stand_hard17": 0.20, # Hitting hard 17+
    
    # Index errors
    "index_not_followed": 0.02,  # Small but cumulative
}


@dataclass
class Evaluator:
    """
    Evaluates training performance and classifies errors.
    """
    
    def evaluate_counting_result(
        self, 
        result: CountingDrillResult
    ) -> EvaluatedError:
        """
        Evaluate a counting drill response.
        
        Args:
            result: The counting drill result to evaluate.
        
        Returns:
            EvaluatedError with details.
        """
        if result.is_correct:
            return EvaluatedError(
                error_type=ErrorType.NONE,
                description="Correct count",
                correct_action=f"RC = {result.correct_count:+d}",
                user_action=f"RC = {result.user_count:+d}",
                ev_loss=0.0,
                severity=0
            )
        
        # Calculate severity based on how far off
        diff = abs(result.user_count - result.correct_count)
        
        if diff == 1:
            severity = 1
            ev_loss = 0.01  # Minor betting mistake
        elif diff <= 3:
            severity = 2
            ev_loss = 0.03  # Moderate impact on betting
        else:
            severity = 3
            ev_loss = 0.05  # Major counting drift
        
        return EvaluatedError(
            error_type=ErrorType.COUNTING,
            description=f"Count off by {diff}",
            correct_action=f"RC = {result.correct_count:+d}",
            user_action=f"RC = {result.user_count:+d}",
            ev_loss=ev_loss,
            severity=severity
        )
    
    def evaluate_play_result(
        self, 
        result: FullPlayResult
    ) -> List[EvaluatedError]:
        """
        Evaluate a full play result for all error types.
        
        Args:
            result: The full play result to evaluate.
        
        Returns:
            List of EvaluatedError (may have multiple types).
        """
        errors = []
        
        # Check strategy error
        if not result.is_correct:
            error = self._evaluate_strategy_error(result)
            errors.append(error)
        
        # Check counting error
        if result.count_correct is not None and not result.count_correct:
            diff = abs(result.user_count - result.correct_count)
            
            if diff == 1:
                severity = 1
                ev_loss = 0.01
            elif diff <= 3:
                severity = 2
                ev_loss = 0.03
            else:
                severity = 3
                ev_loss = 0.05
            
            errors.append(EvaluatedError(
                error_type=ErrorType.COUNTING,
                description=f"Count off by {diff}",
                correct_action=f"RC = {result.correct_count:+d}",
                user_action=f"RC = {result.user_count:+d}",
                ev_loss=ev_loss,
                severity=severity
            ))
        
        # Check index error
        if result.index_applicable and not result.index_followed:
            errors.append(EvaluatedError(
                error_type=ErrorType.INDEX,
                description="Index play not followed",
                correct_action="Deviate from basic strategy",
                user_action="Followed basic strategy",
                ev_loss=EV_LOSS_ESTIMATES["index_not_followed"],
                severity=1
            ))
        
        if not errors:
            errors.append(EvaluatedError(
                error_type=ErrorType.NONE,
                description="Perfect play",
                correct_action=str(result.correct_action.value),
                user_action=str(result.user_action.value),
                ev_loss=0.0,
                severity=0
            ))
        
        return errors
    
    def _evaluate_strategy_error(
        self, 
        result: FullPlayResult
    ) -> EvaluatedError:
        """Evaluate a strategy error with EV loss estimate."""
        
        correct = result.correct_action
        user = result.user_action
        
        # Determine error category and severity
        user_str = user.value
        correct_str = correct.value
        
        # Default EV loss lookup key
        lookup_key = f"{user_str}_vs_{correct_str}".lower()
        
        # Check for major mistakes
        player_value = result.player_hand.value
        
        if (correct == Decision.HIT and 
            user == Action.STAND and 
            player_value >= 12 and player_value <= 16):
            # Standing on stiff vs strong dealer
            lookup_key = "stand_vs_hit_stiff"
            severity = 3
        elif (correct == Decision.STAND and 
              user == Action.HIT and 
              player_value >= 17):
            # Hitting hard 17+
            lookup_key = "hit_vs_stand_hard17"
            severity = 3
        elif correct == Decision.DOUBLE and user == Action.HIT:
            severity = 2
        elif correct == Decision.SPLIT and user == Action.HIT:
            severity = 2
        else:
            severity = 1
        
        ev_loss = EV_LOSS_ESTIMATES.get(lookup_key, 0.05)
        
        return EvaluatedError(
            error_type=ErrorType.STRATEGY,
            description=f"Should {correct_str}, did {user_str}",
            correct_action=correct_str,
            user_action=user_str,
            ev_loss=ev_loss,
            severity=severity
        )


@dataclass
class SessionEvaluator:
    """
    Evaluates an entire training session.
    """
    evaluator: Evaluator = None
    
    def __post_init__(self):
        if self.evaluator is None:
            self.evaluator = Evaluator()
    
    def evaluate_counting_session(
        self, 
        results: List[CountingDrillResult]
    ) -> dict:
        """
        Evaluate a counting drill session.
        
        Returns:
            Dictionary with session statistics.
        """
        if not results:
            return {"total": 0, "correct": 0, "accuracy": 0.0, "total_ev_loss": 0.0}
        
        evaluated = [self.evaluator.evaluate_counting_result(r) for r in results]
        
        correct = sum(1 for e in evaluated if e.error_type == ErrorType.NONE)
        total_ev = sum(e.ev_loss for e in evaluated)
        
        return {
            "total": len(results),
            "correct": correct,
            "accuracy": correct / len(results),
            "total_ev_loss": total_ev,
            "errors_by_severity": {
                1: sum(1 for e in evaluated if e.severity == 1),
                2: sum(1 for e in evaluated if e.severity == 2),
                3: sum(1 for e in evaluated if e.severity == 3),
            }
        }
    
    def evaluate_play_session(
        self, 
        results: List[FullPlayResult]
    ) -> dict:
        """
        Evaluate a full play session.
        
        Returns:
            Dictionary with session statistics.
        """
        if not results:
            return {
                "hands": 0,
                "strategy_accuracy": 0.0,
                "count_accuracy": 0.0,
                "total_ev_loss": 0.0
            }
        
        all_errors = []
        for result in results:
            all_errors.extend(self.evaluator.evaluate_play_result(result))
        
        strategy_correct = sum(1 for r in results if r.is_correct)
        count_quizzed = [r for r in results if r.count_correct is not None]
        count_correct = sum(1 for r in count_quizzed if r.count_correct)
        
        counting_errors = [e for e in all_errors if e.error_type == ErrorType.COUNTING]
        strategy_errors = [e for e in all_errors if e.error_type == ErrorType.STRATEGY]
        index_errors = [e for e in all_errors if e.error_type == ErrorType.INDEX]
        
        total_ev = sum(e.ev_loss for e in all_errors)
        
        return {
            "hands": len(results),
            "strategy_accuracy": strategy_correct / len(results),
            "count_accuracy": count_correct / len(count_quizzed) if count_quizzed else None,
            "total_ev_loss": total_ev,
            "counting_errors": len(counting_errors),
            "strategy_errors": len(strategy_errors),
            "index_errors": len(index_errors),
        }

"""
index_play.py - Count-based strategy deviations (Illustrious 18 + Fab 4).

PURPOSE:
    Provides index numbers for deviating from basic strategy based on
    the true count. These are the most valuable deviations for
    single-deck Hi-Lo counting.

RESPONSIBILITIES:
    - Define index numbers for key deviations
    - Look up when to deviate from basic strategy
    - Prioritize highest-value deviations

MUST NOT:
    - Track the count (counter module does this)
    - Provide basic strategy (basic_strategy module does this)

INDEX PLAYS:
    The Illustrious 18 are the most valuable strategy deviations,
    ordered by expected value gained. The Fab 4 are surrender deviations.
    
    Format: At TC >= index, deviate from basic strategy
    Negative indices mean deviate when TC <= index
"""

from dataclasses import dataclass
from typing import Optional, List
from enum import Enum

from .basic_strategy import Decision


class DeviationType(Enum):
    """Type of deviation."""
    STAND_INSTEAD_OF_HIT = "stand_instead_hit"
    HIT_INSTEAD_OF_STAND = "hit_instead_stand"
    DOUBLE_INSTEAD_OF_HIT = "double_instead_hit"
    DONT_DOUBLE = "dont_double"
    SPLIT_INSTEAD_OF_HIT = "split_instead_hit"
    DONT_SPLIT = "dont_split"
    INSURANCE = "insurance"
    SURRENDER_INSTEAD_OF_HIT = "surrender_instead_hit"
    DONT_SURRENDER = "dont_surrender"


@dataclass(frozen=True)
class IndexPlay:
    """
    Represents a single index play deviation.
    
    Attributes:
        name: Human-readable name of the play.
        player_hand: Description of player's hand (e.g., "16 vs 10").
        basic_action: What basic strategy says to do.
        deviation_action: What to do when index is met.
        index: True count threshold for deviation.
        is_greater_than: If True, deviate when TC >= index.
                         If False, deviate when TC <= index.
        deviation_type: Type of deviation for categorization.
        ev_gain: Estimated EV gain per occurrence (for prioritization).
    """
    name: str
    player_hand: str
    basic_action: Decision
    deviation_action: Decision
    index: int
    is_greater_than: bool = True  # TC >= index to deviate
    deviation_type: DeviationType = DeviationType.STAND_INSTEAD_OF_HIT
    ev_gain: float = 0.0  # Relative priority (higher = more valuable)
    
    def should_deviate(self, true_count: int) -> bool:
        """
        Check if true count warrants deviation.
        
        Args:
            true_count: Current true count (integer).
        
        Returns:
            True if should deviate from basic strategy.
        """
        if self.is_greater_than:
            return true_count >= self.index
        else:
            return true_count <= self.index


# ============================================================================
# ILLUSTRIOUS 18 - Most Valuable Playing Deviations
# Ordered by expected value (1 = most valuable)
# ============================================================================

ILLUSTRIOUS_18: List[IndexPlay] = [
    # 1. Insurance (take at TC >= 3)
    IndexPlay(
        name="Insurance",
        player_hand="Any vs A",
        basic_action=Decision.HIT,  # "Don't take insurance" in basic
        deviation_action=Decision.STAND,  # Represents "take insurance"
        index=3,
        deviation_type=DeviationType.INSURANCE,
        ev_gain=1.0
    ),
    
    # 2. 16 vs 10 - Stand at TC >= 0
    IndexPlay(
        name="16 vs 10 Stand",
        player_hand="16 vs 10",
        basic_action=Decision.HIT,
        deviation_action=Decision.STAND,
        index=0,
        deviation_type=DeviationType.STAND_INSTEAD_OF_HIT,
        ev_gain=0.95
    ),
    
    # 3. 15 vs 10 - Stand at TC >= 4
    IndexPlay(
        name="15 vs 10 Stand",
        player_hand="15 vs 10",
        basic_action=Decision.HIT,
        deviation_action=Decision.STAND,
        index=4,
        deviation_type=DeviationType.STAND_INSTEAD_OF_HIT,
        ev_gain=0.90
    ),
    
    # 4. 10,10 vs 5 - Split at TC >= 5
    IndexPlay(
        name="10,10 vs 5 Split",
        player_hand="10,10 vs 5",
        basic_action=Decision.STAND,
        deviation_action=Decision.SPLIT,
        index=5,
        deviation_type=DeviationType.SPLIT_INSTEAD_OF_HIT,
        ev_gain=0.85
    ),
    
    # 5. 10,10 vs 6 - Split at TC >= 4
    IndexPlay(
        name="10,10 vs 6 Split",
        player_hand="10,10 vs 6",
        basic_action=Decision.STAND,
        deviation_action=Decision.SPLIT,
        index=4,
        deviation_type=DeviationType.SPLIT_INSTEAD_OF_HIT,
        ev_gain=0.80
    ),
    
    # 6. 10 vs 10 - Double at TC >= 4
    IndexPlay(
        name="10 vs 10 Double",
        player_hand="10 vs 10",
        basic_action=Decision.HIT,
        deviation_action=Decision.DOUBLE,
        index=4,
        deviation_type=DeviationType.DOUBLE_INSTEAD_OF_HIT,
        ev_gain=0.75
    ),
    
    # 7. 12 vs 3 - Stand at TC >= 2
    IndexPlay(
        name="12 vs 3 Stand",
        player_hand="12 vs 3",
        basic_action=Decision.HIT,
        deviation_action=Decision.STAND,
        index=2,
        deviation_type=DeviationType.STAND_INSTEAD_OF_HIT,
        ev_gain=0.70
    ),
    
    # 8. 12 vs 2 - Stand at TC >= 3
    IndexPlay(
        name="12 vs 2 Stand",
        player_hand="12 vs 2",
        basic_action=Decision.HIT,
        deviation_action=Decision.STAND,
        index=3,
        deviation_type=DeviationType.STAND_INSTEAD_OF_HIT,
        ev_gain=0.65
    ),
    
    # 9. 11 vs A - Double at TC >= 1
    IndexPlay(
        name="11 vs A Double",
        player_hand="11 vs A",
        basic_action=Decision.HIT,
        deviation_action=Decision.DOUBLE,
        index=1,
        deviation_type=DeviationType.DOUBLE_INSTEAD_OF_HIT,
        ev_gain=0.60
    ),
    
    # 10. 9 vs 2 - Double at TC >= 1
    IndexPlay(
        name="9 vs 2 Double",
        player_hand="9 vs 2",
        basic_action=Decision.HIT,
        deviation_action=Decision.DOUBLE,
        index=1,
        deviation_type=DeviationType.DOUBLE_INSTEAD_OF_HIT,
        ev_gain=0.55
    ),
    
    # 11. 10 vs A - Double at TC >= 4
    IndexPlay(
        name="10 vs A Double",
        player_hand="10 vs A",
        basic_action=Decision.HIT,
        deviation_action=Decision.DOUBLE,
        index=4,
        deviation_type=DeviationType.DOUBLE_INSTEAD_OF_HIT,
        ev_gain=0.50
    ),
    
    # 12. 9 vs 7 - Double at TC >= 3
    IndexPlay(
        name="9 vs 7 Double",
        player_hand="9 vs 7",
        basic_action=Decision.HIT,
        deviation_action=Decision.DOUBLE,
        index=3,
        deviation_type=DeviationType.DOUBLE_INSTEAD_OF_HIT,
        ev_gain=0.45
    ),
    
    # 13. 16 vs 9 - Stand at TC >= 5
    IndexPlay(
        name="16 vs 9 Stand",
        player_hand="16 vs 9",
        basic_action=Decision.HIT,
        deviation_action=Decision.STAND,
        index=5,
        deviation_type=DeviationType.STAND_INSTEAD_OF_HIT,
        ev_gain=0.40
    ),
    
    # 14. 13 vs 2 - Hit at TC <= -1
    IndexPlay(
        name="13 vs 2 Hit",
        player_hand="13 vs 2",
        basic_action=Decision.STAND,
        deviation_action=Decision.HIT,
        index=-1,
        is_greater_than=False,
        deviation_type=DeviationType.HIT_INSTEAD_OF_STAND,
        ev_gain=0.35
    ),
    
    # 15. 12 vs 4 - Hit at TC <= 0
    IndexPlay(
        name="12 vs 4 Hit",
        player_hand="12 vs 4",
        basic_action=Decision.STAND,
        deviation_action=Decision.HIT,
        index=0,
        is_greater_than=False,
        deviation_type=DeviationType.HIT_INSTEAD_OF_STAND,
        ev_gain=0.30
    ),
    
    # 16. 12 vs 5 - Hit at TC <= -2
    IndexPlay(
        name="12 vs 5 Hit",
        player_hand="12 vs 5",
        basic_action=Decision.STAND,
        deviation_action=Decision.HIT,
        index=-2,
        is_greater_than=False,
        deviation_type=DeviationType.HIT_INSTEAD_OF_STAND,
        ev_gain=0.25
    ),
    
    # 17. 12 vs 6 - Hit at TC <= -1
    IndexPlay(
        name="12 vs 6 Hit",
        player_hand="12 vs 6",
        basic_action=Decision.STAND,
        deviation_action=Decision.HIT,
        index=-1,
        is_greater_than=False,
        deviation_type=DeviationType.HIT_INSTEAD_OF_STAND,
        ev_gain=0.20
    ),
    
    # 18. 13 vs 3 - Hit at TC <= -2
    IndexPlay(
        name="13 vs 3 Hit",
        player_hand="13 vs 3",
        basic_action=Decision.STAND,
        deviation_action=Decision.HIT,
        index=-2,
        is_greater_than=False,
        deviation_type=DeviationType.HIT_INSTEAD_OF_STAND,
        ev_gain=0.15
    ),
]


# ============================================================================
# FAB 4 - Surrender Deviations
# ============================================================================

FAB_4: List[IndexPlay] = [
    # 1. 14 vs 10 - Surrender at TC >= 3
    IndexPlay(
        name="14 vs 10 Surrender",
        player_hand="14 vs 10",
        basic_action=Decision.HIT,
        deviation_action=Decision.SURRENDER_HIT,
        index=3,
        deviation_type=DeviationType.SURRENDER_INSTEAD_OF_HIT,
        ev_gain=0.30
    ),
    
    # 2. 15 vs 9 - Surrender at TC >= 2
    IndexPlay(
        name="15 vs 9 Surrender",
        player_hand="15 vs 9",
        basic_action=Decision.HIT,
        deviation_action=Decision.SURRENDER_HIT,
        index=2,
        deviation_type=DeviationType.SURRENDER_INSTEAD_OF_HIT,
        ev_gain=0.25
    ),
    
    # 3. 15 vs A - Surrender at TC >= 1
    IndexPlay(
        name="15 vs A Surrender",
        player_hand="15 vs A",
        basic_action=Decision.HIT,
        deviation_action=Decision.SURRENDER_HIT,
        index=1,
        deviation_type=DeviationType.SURRENDER_INSTEAD_OF_HIT,
        ev_gain=0.20
    ),
    
    # 4. 14 vs A - Surrender at TC >= 3
    IndexPlay(
        name="14 vs A Surrender",
        player_hand="14 vs A",
        basic_action=Decision.HIT,
        deviation_action=Decision.SURRENDER_HIT,
        index=3,
        deviation_type=DeviationType.SURRENDER_INSTEAD_OF_HIT,
        ev_gain=0.15
    ),
]


# Combined list for easy iteration
ALL_INDEX_PLAYS: List[IndexPlay] = ILLUSTRIOUS_18 + FAB_4


@dataclass
class IndexPlayLookup:
    """
    Lookup service for index plays.
    
    Matches a hand situation to potential index play deviations.
    """
    plays: List[IndexPlay] = None
    
    def __post_init__(self):
        if self.plays is None:
            self.plays = ALL_INDEX_PLAYS
    
    def find_applicable_play(
        self,
        player_total: int,
        dealer_upcard_value: int,
        is_pair: bool = False,
        pair_value: Optional[int] = None,
        is_soft: bool = False
    ) -> Optional[IndexPlay]:
        """
        Find the index play that matches this situation.
        
        Args:
            player_total: Player's hand total.
            dealer_upcard_value: Dealer's upcard value (Ace = 11).
            is_pair: Whether player has a pair.
            pair_value: Value of the pair (if is_pair is True).
            is_soft: Whether the hand is soft.
        
        Returns:
            The matching IndexPlay, or None if no deviation applies.
        """
        # Build the hand description to match
        dealer_str = "A" if dealer_upcard_value == 11 else str(dealer_upcard_value)
        
        for play in self.plays:
            # Check for pair plays
            if is_pair and pair_value == 10:
                if f"10,10 vs {dealer_str}" in play.player_hand:
                    return play
            
            # Check for insurance
            if play.deviation_type == DeviationType.INSURANCE:
                if dealer_upcard_value == 11:
                    return play
                continue
            
            # Check for hard total plays
            if not is_soft and not is_pair:
                if f"{player_total} vs {dealer_str}" in play.player_hand:
                    return play
        
        return None
    
    def get_deviation(
        self,
        player_total: int,
        dealer_upcard_value: int,
        true_count: int,
        is_pair: bool = False,
        pair_value: Optional[int] = None,
        is_soft: bool = False
    ) -> Optional[Decision]:
        """
        Get the deviation decision if true count warrants it.
        
        Args:
            player_total: Player's hand total.
            dealer_upcard_value: Dealer's upcard value.
            true_count: Current true count.
            is_pair: Whether player has a pair.
            pair_value: Value of the pair.
            is_soft: Whether the hand is soft.
        
        Returns:
            The deviation Decision if TC warrants deviation, None otherwise.
        """
        play = self.find_applicable_play(
            player_total, 
            dealer_upcard_value,
            is_pair,
            pair_value,
            is_soft
        )
        
        if play and play.should_deviate(true_count):
            return play.deviation_action
        
        return None

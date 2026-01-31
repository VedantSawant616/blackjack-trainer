"""
basic_strategy.py - Single-deck basic strategy reference.

PURPOSE:
    Provides the mathematically correct basic strategy for single-deck
    blackjack. This is the baseline against which player decisions
    are evaluated.

RESPONSIBILITIES:
    - Look up the correct action for any hand vs dealer upcard
    - Handle hard totals, soft totals, and pairs
    - Support both H17 and S17 dealer rules

MUST NOT:
    - Consider the count (index_play handles deviations)
    - Make probabilistic calculations (this is a lookup table)

STRATEGY CHARTS:
    Based on single-deck basic strategy with:
    - DAS (Double After Split) allowed
    - Late surrender allowed
    - Dealer peeks for blackjack

    Legend:
    H  = Hit
    S  = Stand
    D  = Double (hit if not allowed)
    Ds = Double (stand if not allowed)
    P  = Split
    Rh = Surrender (hit if not allowed)
    Rs = Surrender (stand if not allowed)
"""

from enum import Enum
from typing import Optional
from dataclasses import dataclass

from ..game.hand import Hand
from ..game.deck import Card, Rank
from ..game.dealer import DealerRule


class Decision(Enum):
    """Basic strategy decisions."""
    HIT = "H"
    STAND = "S"
    DOUBLE = "D"         # Double, or hit if not allowed
    DOUBLE_STAND = "Ds"  # Double, or stand if not allowed
    SPLIT = "P"
    SURRENDER_HIT = "Rh"    # Surrender, or hit if not allowed
    SURRENDER_STAND = "Rs"  # Surrender, or stand if not allowed
    SURRENDER_SPLIT = "Rp"  # Surrender, or split if not allowed


# Single-deck basic strategy charts
# Key: (player_total_or_pair, dealer_upcard_value)
# Upcard values: 2-10 for 2-10, 11 for Ace

# Hard totals (player has no usable Ace)
# Rows: 5-17 (below 5 always hit, 17+ always stand)
HARD_STRATEGY_H17: dict[tuple[int, int], Decision] = {
    # Hard 5-8: Always hit
    **{(5, d): Decision.HIT for d in range(2, 12)},
    **{(6, d): Decision.HIT for d in range(2, 12)},
    **{(7, d): Decision.HIT for d in range(2, 12)},
    **{(8, d): Decision.HIT for d in range(2, 12)},
    
    # Hard 9
    (9, 2): Decision.DOUBLE,
    (9, 3): Decision.DOUBLE,
    (9, 4): Decision.DOUBLE,
    (9, 5): Decision.DOUBLE,
    (9, 6): Decision.DOUBLE,
    (9, 7): Decision.HIT,
    (9, 8): Decision.HIT,
    (9, 9): Decision.HIT,
    (9, 10): Decision.HIT,
    (9, 11): Decision.HIT,
    
    # Hard 10
    (10, 2): Decision.DOUBLE,
    (10, 3): Decision.DOUBLE,
    (10, 4): Decision.DOUBLE,
    (10, 5): Decision.DOUBLE,
    (10, 6): Decision.DOUBLE,
    (10, 7): Decision.DOUBLE,
    (10, 8): Decision.DOUBLE,
    (10, 9): Decision.DOUBLE,
    (10, 10): Decision.HIT,
    (10, 11): Decision.HIT,
    
    # Hard 11
    (11, 2): Decision.DOUBLE,
    (11, 3): Decision.DOUBLE,
    (11, 4): Decision.DOUBLE,
    (11, 5): Decision.DOUBLE,
    (11, 6): Decision.DOUBLE,
    (11, 7): Decision.DOUBLE,
    (11, 8): Decision.DOUBLE,
    (11, 9): Decision.DOUBLE,
    (11, 10): Decision.DOUBLE,
    (11, 11): Decision.DOUBLE,
    
    # Hard 12
    (12, 2): Decision.HIT,
    (12, 3): Decision.HIT,
    (12, 4): Decision.STAND,
    (12, 5): Decision.STAND,
    (12, 6): Decision.STAND,
    (12, 7): Decision.HIT,
    (12, 8): Decision.HIT,
    (12, 9): Decision.HIT,
    (12, 10): Decision.HIT,
    (12, 11): Decision.HIT,
    
    # Hard 13
    (13, 2): Decision.STAND,
    (13, 3): Decision.STAND,
    (13, 4): Decision.STAND,
    (13, 5): Decision.STAND,
    (13, 6): Decision.STAND,
    (13, 7): Decision.HIT,
    (13, 8): Decision.HIT,
    (13, 9): Decision.HIT,
    (13, 10): Decision.HIT,
    (13, 11): Decision.HIT,
    
    # Hard 14
    (14, 2): Decision.STAND,
    (14, 3): Decision.STAND,
    (14, 4): Decision.STAND,
    (14, 5): Decision.STAND,
    (14, 6): Decision.STAND,
    (14, 7): Decision.HIT,
    (14, 8): Decision.HIT,
    (14, 9): Decision.HIT,
    (14, 10): Decision.HIT,
    (14, 11): Decision.HIT,
    
    # Hard 15
    (15, 2): Decision.STAND,
    (15, 3): Decision.STAND,
    (15, 4): Decision.STAND,
    (15, 5): Decision.STAND,
    (15, 6): Decision.STAND,
    (15, 7): Decision.HIT,
    (15, 8): Decision.HIT,
    (15, 9): Decision.HIT,
    (15, 10): Decision.SURRENDER_HIT,
    (15, 11): Decision.SURRENDER_HIT,
    
    # Hard 16
    (16, 2): Decision.STAND,
    (16, 3): Decision.STAND,
    (16, 4): Decision.STAND,
    (16, 5): Decision.STAND,
    (16, 6): Decision.STAND,
    (16, 7): Decision.HIT,
    (16, 8): Decision.HIT,
    (16, 9): Decision.SURRENDER_HIT,
    (16, 10): Decision.SURRENDER_HIT,
    (16, 11): Decision.SURRENDER_HIT,
    
    # Hard 17+: Always stand
    **{(17, d): Decision.STAND for d in range(2, 12)},
    **{(18, d): Decision.STAND for d in range(2, 12)},
    **{(19, d): Decision.STAND for d in range(2, 12)},
    **{(20, d): Decision.STAND for d in range(2, 12)},
    **{(21, d): Decision.STAND for d in range(2, 12)},
}

# Soft totals (player has Ace counted as 11)
# Rows: Soft 13 (A,2) through Soft 20 (A,9)
SOFT_STRATEGY_H17: dict[tuple[int, int], Decision] = {
    # Soft 13 (A,2)
    (13, 2): Decision.HIT,
    (13, 3): Decision.HIT,
    (13, 4): Decision.DOUBLE,
    (13, 5): Decision.DOUBLE,
    (13, 6): Decision.DOUBLE,
    (13, 7): Decision.HIT,
    (13, 8): Decision.HIT,
    (13, 9): Decision.HIT,
    (13, 10): Decision.HIT,
    (13, 11): Decision.HIT,
    
    # Soft 14 (A,3)
    (14, 2): Decision.HIT,
    (14, 3): Decision.HIT,
    (14, 4): Decision.DOUBLE,
    (14, 5): Decision.DOUBLE,
    (14, 6): Decision.DOUBLE,
    (14, 7): Decision.HIT,
    (14, 8): Decision.HIT,
    (14, 9): Decision.HIT,
    (14, 10): Decision.HIT,
    (14, 11): Decision.HIT,
    
    # Soft 15 (A,4)
    (15, 2): Decision.HIT,
    (15, 3): Decision.HIT,
    (15, 4): Decision.DOUBLE,
    (15, 5): Decision.DOUBLE,
    (15, 6): Decision.DOUBLE,
    (15, 7): Decision.HIT,
    (15, 8): Decision.HIT,
    (15, 9): Decision.HIT,
    (15, 10): Decision.HIT,
    (15, 11): Decision.HIT,
    
    # Soft 16 (A,5)
    (16, 2): Decision.HIT,
    (16, 3): Decision.HIT,
    (16, 4): Decision.DOUBLE,
    (16, 5): Decision.DOUBLE,
    (16, 6): Decision.DOUBLE,
    (16, 7): Decision.HIT,
    (16, 8): Decision.HIT,
    (16, 9): Decision.HIT,
    (16, 10): Decision.HIT,
    (16, 11): Decision.HIT,
    
    # Soft 17 (A,6)
    (17, 2): Decision.DOUBLE,
    (17, 3): Decision.DOUBLE,
    (17, 4): Decision.DOUBLE,
    (17, 5): Decision.DOUBLE,
    (17, 6): Decision.DOUBLE,
    (17, 7): Decision.HIT,
    (17, 8): Decision.HIT,
    (17, 9): Decision.HIT,
    (17, 10): Decision.HIT,
    (17, 11): Decision.HIT,
    
    # Soft 18 (A,7)
    (18, 2): Decision.STAND,
    (18, 3): Decision.DOUBLE_STAND,
    (18, 4): Decision.DOUBLE_STAND,
    (18, 5): Decision.DOUBLE_STAND,
    (18, 6): Decision.DOUBLE_STAND,
    (18, 7): Decision.STAND,
    (18, 8): Decision.STAND,
    (18, 9): Decision.HIT,
    (18, 10): Decision.HIT,
    (18, 11): Decision.STAND,
    
    # Soft 19 (A,8)
    (19, 2): Decision.STAND,
    (19, 3): Decision.STAND,
    (19, 4): Decision.STAND,
    (19, 5): Decision.STAND,
    (19, 6): Decision.DOUBLE_STAND,
    (19, 7): Decision.STAND,
    (19, 8): Decision.STAND,
    (19, 9): Decision.STAND,
    (19, 10): Decision.STAND,
    (19, 11): Decision.STAND,
    
    # Soft 20 (A,9): Always stand
    **{(20, d): Decision.STAND for d in range(2, 12)},
    
    # Soft 21 (A,10): Always stand (blackjack handled separately)
    **{(21, d): Decision.STAND for d in range(2, 12)},
}

# Pair splitting strategy
# Key: (pair_rank_value, dealer_upcard_value)
# Ace = 11, 10/J/Q/K = 10
PAIR_STRATEGY_H17: dict[tuple[int, int], Decision] = {
    # Pair of 2s
    (2, 2): Decision.SPLIT,
    (2, 3): Decision.SPLIT,
    (2, 4): Decision.SPLIT,
    (2, 5): Decision.SPLIT,
    (2, 6): Decision.SPLIT,
    (2, 7): Decision.SPLIT,
    (2, 8): Decision.HIT,
    (2, 9): Decision.HIT,
    (2, 10): Decision.HIT,
    (2, 11): Decision.HIT,
    
    # Pair of 3s
    (3, 2): Decision.SPLIT,
    (3, 3): Decision.SPLIT,
    (3, 4): Decision.SPLIT,
    (3, 5): Decision.SPLIT,
    (3, 6): Decision.SPLIT,
    (3, 7): Decision.SPLIT,
    (3, 8): Decision.SPLIT,
    (3, 9): Decision.HIT,
    (3, 10): Decision.HIT,
    (3, 11): Decision.HIT,
    
    # Pair of 4s
    (4, 2): Decision.HIT,
    (4, 3): Decision.HIT,
    (4, 4): Decision.SPLIT,
    (4, 5): Decision.SPLIT,
    (4, 6): Decision.SPLIT,
    (4, 7): Decision.HIT,
    (4, 8): Decision.HIT,
    (4, 9): Decision.HIT,
    (4, 10): Decision.HIT,
    (4, 11): Decision.HIT,
    
    # Pair of 5s: Never split, treat as hard 10
    (5, 2): Decision.DOUBLE,
    (5, 3): Decision.DOUBLE,
    (5, 4): Decision.DOUBLE,
    (5, 5): Decision.DOUBLE,
    (5, 6): Decision.DOUBLE,
    (5, 7): Decision.DOUBLE,
    (5, 8): Decision.DOUBLE,
    (5, 9): Decision.DOUBLE,
    (5, 10): Decision.HIT,
    (5, 11): Decision.HIT,
    
    # Pair of 6s
    (6, 2): Decision.SPLIT,
    (6, 3): Decision.SPLIT,
    (6, 4): Decision.SPLIT,
    (6, 5): Decision.SPLIT,
    (6, 6): Decision.SPLIT,
    (6, 7): Decision.SPLIT,
    (6, 8): Decision.HIT,
    (6, 9): Decision.HIT,
    (6, 10): Decision.HIT,
    (6, 11): Decision.HIT,
    
    # Pair of 7s
    (7, 2): Decision.SPLIT,
    (7, 3): Decision.SPLIT,
    (7, 4): Decision.SPLIT,
    (7, 5): Decision.SPLIT,
    (7, 6): Decision.SPLIT,
    (7, 7): Decision.SPLIT,
    (7, 8): Decision.SPLIT,
    (7, 9): Decision.HIT,
    (7, 10): Decision.SURRENDER_HIT,
    (7, 11): Decision.HIT,
    
    # Pair of 8s: Always split
    **{(8, d): Decision.SPLIT for d in range(2, 12)},
    
    # Pair of 9s
    (9, 2): Decision.SPLIT,
    (9, 3): Decision.SPLIT,
    (9, 4): Decision.SPLIT,
    (9, 5): Decision.SPLIT,
    (9, 6): Decision.SPLIT,
    (9, 7): Decision.STAND,
    (9, 8): Decision.SPLIT,
    (9, 9): Decision.SPLIT,
    (9, 10): Decision.STAND,
    (9, 11): Decision.STAND,
    
    # Pair of 10s: Never split
    **{(10, d): Decision.STAND for d in range(2, 12)},
    
    # Pair of Aces: Always split
    **{(11, d): Decision.SPLIT for d in range(2, 12)},
}


def get_upcard_value(upcard: Card) -> int:
    """Convert upcard to strategy lookup value (Ace = 11)."""
    if upcard.is_ace:
        return 11
    return upcard.value


def get_pair_value(hand: Hand) -> int:
    """Get the pair value for strategy lookup (Ace = 11)."""
    card = hand.cards[0]
    if card.is_ace:
        return 11
    return card.value


@dataclass
class BasicStrategy:
    """
    Single-deck basic strategy lookup.
    
    Provides the correct play for any hand vs dealer upcard.
    Supports both H17 and S17 rules.
    """
    dealer_rule: DealerRule = DealerRule.H17
    
    def get_decision(
        self, 
        hand: Hand, 
        dealer_upcard: Card,
        can_double: bool = True,
        can_split: bool = True,
        can_surrender: bool = True
    ) -> Decision:
        """
        Get the correct basic strategy decision.
        
        Args:
            hand: Player's hand.
            dealer_upcard: Dealer's visible card.
            can_double: Whether doubling is allowed.
            can_split: Whether splitting is allowed.
            can_surrender: Whether surrender is allowed.
        
        Returns:
            The correct Decision enum.
        """
        upcard_val = get_upcard_value(dealer_upcard)
        
        # Check for pairs first
        if hand.is_pair and can_split:
            pair_val = get_pair_value(hand)
            decision = PAIR_STRATEGY_H17.get((pair_val, upcard_val))
            
            if decision == Decision.SPLIT:
                return Decision.SPLIT
            elif decision == Decision.SURRENDER_SPLIT:
                return Decision.SURRENDER_HIT if can_surrender else Decision.SPLIT
            # If not splitting, fall through to soft/hard logic
        
        # Check soft vs hard
        value, is_soft = hand.soft_value
        
        if is_soft:
            # Soft hand lookup
            decision = SOFT_STRATEGY_H17.get((value, upcard_val), Decision.STAND)
        else:
            # Hard hand lookup
            if value < 5:
                decision = Decision.HIT
            elif value > 21:
                decision = Decision.STAND  # Busted, doesn't matter
            else:
                decision = HARD_STRATEGY_H17.get((value, upcard_val), Decision.HIT)
        
        # Adjust decision based on what's allowed
        decision = self._adjust_decision(decision, can_double, can_surrender)
        
        return decision
    
    def _adjust_decision(
        self, 
        decision: Decision, 
        can_double: bool, 
        can_surrender: bool
    ) -> Decision:
        """Adjust decision based on what actions are allowed."""
        
        if decision == Decision.DOUBLE and not can_double:
            return Decision.HIT
        
        if decision == Decision.DOUBLE_STAND and not can_double:
            return Decision.STAND
        
        if decision == Decision.SURRENDER_HIT and not can_surrender:
            return Decision.HIT
        
        if decision == Decision.SURRENDER_STAND and not can_surrender:
            return Decision.STAND
        
        if decision == Decision.SURRENDER_SPLIT and not can_surrender:
            return Decision.SPLIT
        
        return decision
    
    def get_action_string(self, decision: Decision) -> str:
        """Convert decision to human-readable action."""
        action_map = {
            Decision.HIT: "Hit",
            Decision.STAND: "Stand",
            Decision.DOUBLE: "Double",
            Decision.DOUBLE_STAND: "Double (stand if not allowed)",
            Decision.SPLIT: "Split",
            Decision.SURRENDER_HIT: "Surrender (hit if not allowed)",
            Decision.SURRENDER_STAND: "Surrender (stand if not allowed)",
            Decision.SURRENDER_SPLIT: "Surrender (split if not allowed)",
        }
        return action_map.get(decision, str(decision))

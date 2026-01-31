"""
hand.py - Blackjack hand representation and value calculation.

PURPOSE:
    Represents a blackjack hand with proper hard/soft total calculation.
    Handles the complexity of Ace valuation (1 or 11).

RESPONSIBILITIES:
    - Store cards in a hand
    - Calculate hand value (handling Aces correctly)
    - Detect blackjack, bust, soft hands, and pairs
    - Support split hand creation

MUST NOT:
    - Make decisions (strategy module handles this)
    - Track bets (player module handles this)
    - Deal cards (engine handles this)
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from enum import Enum

from .deck import Card, Rank


class HandStatus(Enum):
    """Status of a hand during play."""
    ACTIVE = "active"           # Can still take actions
    STOOD = "stood"             # Player chose to stand
    BUSTED = "busted"           # Hand value > 21
    BLACKJACK = "blackjack"     # Natural 21 (Ace + 10-value, first two cards)
    SURRENDERED = "surrendered" # Player surrendered
    DOUBLED = "doubled"         # Player doubled (only one more card allowed)


@dataclass
class Hand:
    """
    Represents a blackjack hand.
    
    This class handles the core logic of blackjack hand valuation:
    - Aces count as 11 unless that would bust the hand
    - Soft hands have an Ace counting as 11
    - Hard hands have all Aces counting as 1 (or no Aces)
    
    Attributes:
        cards: List of cards in the hand.
        status: Current status of the hand.
        bet: Amount wagered on this hand (0 for dealer).
        is_split_hand: True if this hand was created from a split.
        is_doubled: True if player doubled down on this hand.
    """
    cards: List[Card] = field(default_factory=list)
    status: HandStatus = HandStatus.ACTIVE
    bet: float = 0.0
    is_split_hand: bool = False
    is_doubled: bool = False
    
    def add_card(self, card: Card) -> None:
        """
        Add a card to the hand.
        
        After adding, checks for bust and updates status accordingly.
        """
        self.cards.append(card)
        if self.value > 21:
            self.status = HandStatus.BUSTED
    
    @property
    def value(self) -> int:
        """
        Calculate the best hand value, handling Aces optimally.
        
        Algorithm:
        1. Sum all card values (Aces as 11)
        2. For each Ace, if total > 21, convert one Ace from 11 to 1 (-10)
        3. Continue until total <= 21 or all Aces are counted as 1
        
        Returns:
            The best possible hand value (may be > 21 if busted).
        """
        total = sum(card.value for card in self.cards)
        aces = sum(1 for card in self.cards if card.is_ace)
        
        # Convert Aces from 11 to 1 as needed
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        
        return total
    
    @property
    def soft_value(self) -> Tuple[int, bool]:
        """
        Returns (value, is_soft) tuple for strategy decisions.
        
        A hand is "soft" if it contains an Ace being counted as 11.
        This distinction is critical for basic strategy.
        
        Returns:
            Tuple of (hand value, True if soft hand).
        """
        total = sum(card.value for card in self.cards)
        aces = sum(1 for card in self.cards if card.is_ace)
        
        # Count how many Aces we need to convert to avoid bust
        converted_aces = 0
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
            converted_aces += 1
        
        # Hand is soft if at least one Ace is still counted as 11
        original_aces = sum(1 for card in self.cards if card.is_ace)
        is_soft = (original_aces > converted_aces) and total <= 21
        
        return (total, is_soft)
    
    @property
    def is_soft(self) -> bool:
        """Returns True if this is a soft hand (Ace counted as 11)."""
        _, soft = self.soft_value
        return soft
    
    @property
    def is_hard(self) -> bool:
        """Returns True if this is a hard hand (no Ace counted as 11)."""
        return not self.is_soft
    
    @property
    def is_blackjack(self) -> bool:
        """
        Returns True if this is a natural blackjack.
        
        Natural blackjack requires:
        - Exactly 2 cards
        - Total value of 21
        - NOT a split hand (split Aces getting a 10 is not blackjack)
        """
        return (
            len(self.cards) == 2 
            and self.value == 21 
            and not self.is_split_hand
        )
    
    @property
    def is_busted(self) -> bool:
        """Returns True if hand value exceeds 21."""
        return self.value > 21
    
    @property
    def is_pair(self) -> bool:
        """
        Returns True if hand is a splittable pair.
        
        A pair is exactly two cards of the same rank.
        Note: 10-J, 10-Q, etc. are NOT pairs (different ranks).
        """
        return (
            len(self.cards) == 2 
            and self.cards[0].rank == self.cards[1].rank
        )
    
    @property
    def is_ten_pair(self) -> bool:
        """
        Returns True if hand is a pair of 10-value cards.
        
        This includes any combination of 10, J, Q, K.
        Important for split strategy (never split 10s in basic strategy).
        """
        return (
            len(self.cards) == 2
            and self.cards[0].is_ten_value
            and self.cards[1].is_ten_value
        )
    
    @property
    def can_double(self) -> bool:
        """
        Returns True if doubling is allowed.
        
        Standard rule: Can double on first two cards only.
        """
        return len(self.cards) == 2 and self.status == HandStatus.ACTIVE
    
    @property
    def can_split(self) -> bool:
        """
        Returns True if splitting is allowed.
        
        Must have exactly 2 cards of the same rank.
        """
        return self.is_pair and self.status == HandStatus.ACTIVE
    
    @property
    def can_hit(self) -> bool:
        """Returns True if player can take another card."""
        return self.status == HandStatus.ACTIVE and not self.is_busted
    
    @property
    def can_stand(self) -> bool:
        """Returns True if player can stand."""
        return self.status == HandStatus.ACTIVE
    
    @property
    def can_surrender(self) -> bool:
        """
        Returns True if late surrender is allowed.
        
        Late surrender: Only available on first two cards, before any other action.
        """
        return len(self.cards) == 2 and self.status == HandStatus.ACTIVE
    
    def stand(self) -> None:
        """Mark this hand as stood."""
        self.status = HandStatus.STOOD
    
    def double_down(self) -> None:
        """Mark this hand as doubled."""
        self.is_doubled = True
        self.status = HandStatus.DOUBLED
    
    def surrender(self) -> None:
        """Mark this hand as surrendered."""
        self.status = HandStatus.SURRENDERED
    
    def split(self) -> Tuple['Hand', 'Hand']:
        """
        Split this hand into two new hands.
        
        Returns:
            Tuple of two new Hand objects, each with one card and same bet.
        
        Raises:
            ValueError: If hand cannot be split (not a pair or already acted).
        """
        if not self.can_split:
            raise ValueError("Cannot split: not a pair or already acted")
        
        hand1 = Hand(
            cards=[self.cards[0]], 
            bet=self.bet,
            is_split_hand=True
        )
        hand2 = Hand(
            cards=[self.cards[1]], 
            bet=self.bet,
            is_split_hand=True
        )
        
        return hand1, hand2
    
    def reset(self) -> None:
        """Clear the hand for a new round."""
        self.cards.clear()
        self.status = HandStatus.ACTIVE
        self.bet = 0.0
        self.is_split_hand = False
        self.is_doubled = False
    
    @property
    def upcard(self) -> Optional[Card]:
        """Returns the first card (used for dealer upcard)."""
        return self.cards[0] if self.cards else None
    
    @property
    def hole_card(self) -> Optional[Card]:
        """Returns the second card (dealer's hole card)."""
        return self.cards[1] if len(self.cards) >= 2 else None
    
    def __str__(self) -> str:
        """Human-readable hand representation."""
        cards_str = " ".join(str(card) for card in self.cards)
        value, soft = self.soft_value
        soft_str = " (soft)" if soft else ""
        return f"[{cards_str}] = {value}{soft_str}"
    
    def __repr__(self) -> str:
        return f"Hand({self.cards}, value={self.value})"
    
    def __len__(self) -> int:
        return len(self.cards)

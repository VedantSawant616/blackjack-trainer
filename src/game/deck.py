"""
deck.py - Single 52-card deck representation.

PURPOSE:
    Provides the fundamental card representation and deck creation logic.
    This is the atomic unit of the game — cards and their properties.

RESPONSIBILITIES:
    - Define card ranks and suits
    - Create a standard 52-card deck
    - Provide card value calculation for blackjack

MUST NOT:
    - Shuffle cards (Shoe handles this)
    - Track which cards have been dealt (Shoe handles this)
    - Manage game state
"""

from dataclasses import dataclass
from enum import Enum
from typing import List


class Suit(Enum):
    """Card suits. Order doesn't matter for blackjack, but included for completeness."""
    CLUBS = "♣"
    DIAMONDS = "♦"
    HEARTS = "♥"
    SPADES = "♠"


class Rank(Enum):
    """
    Card ranks with their Hi-Lo tag values and blackjack point values.
    
    Blackjack values:
        - 2-10: Face value
        - J, Q, K: 10
        - A: 1 or 11 (handled at hand level)
    
    Hi-Lo values:
        - 2-6: +1 (low cards favor player when removed)
        - 7-9: 0 (neutral)
        - 10-A: -1 (high cards favor player when in deck)
    """
    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "10"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"
    ACE = "A"


# Blackjack point values for each rank
RANK_VALUES: dict[Rank, int] = {
    Rank.TWO: 2,
    Rank.THREE: 3,
    Rank.FOUR: 4,
    Rank.FIVE: 5,
    Rank.SIX: 6,
    Rank.SEVEN: 7,
    Rank.EIGHT: 8,
    Rank.NINE: 9,
    Rank.TEN: 10,
    Rank.JACK: 10,
    Rank.QUEEN: 10,
    Rank.KING: 10,
    Rank.ACE: 11,  # Default to 11; hand logic will adjust
}


@dataclass(frozen=True)
class Card:
    """
    Immutable representation of a playing card.
    
    Frozen dataclass ensures cards cannot be modified after creation,
    which is important for maintaining game integrity.
    """
    rank: Rank
    suit: Suit
    
    @property
    def value(self) -> int:
        """
        Returns the blackjack point value of this card.
        
        Note: Aces return 11 here. The Hand class is responsible for
        determining whether to count an Ace as 1 or 11.
        """
        return RANK_VALUES[self.rank]
    
    @property
    def is_ace(self) -> bool:
        """Returns True if this card is an Ace."""
        return self.rank == Rank.ACE
    
    @property
    def is_ten_value(self) -> bool:
        """Returns True if this card has a value of 10 (10, J, Q, K)."""
        return self.value == 10
    
    def __str__(self) -> str:
        """Human-readable card representation, e.g., 'A♠' or '10♥'."""
        return f"{self.rank.value}{self.suit.value}"
    
    def __repr__(self) -> str:
        return f"Card({self.rank.value}{self.suit.value})"


def create_deck() -> List[Card]:
    """
    Creates a standard 52-card deck.
    
    Returns:
        List of 52 Card objects, one for each rank-suit combination.
        Cards are returned in a deterministic order (not shuffled).
    """
    return [Card(rank, suit) for suit in Suit for rank in Rank]


# Convenience constant for deck size
DECK_SIZE: int = 52

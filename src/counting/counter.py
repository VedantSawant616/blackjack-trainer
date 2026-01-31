"""
counter.py - Running count and true count tracker.

PURPOSE:
    Maintains the running count as cards are exposed.
    Calculates true count based on decks remaining.

RESPONSIBILITIES:
    - Track running count
    - Calculate true count
    - Reset on shuffle
    - Track cards seen for verification

MUST NOT:
    - Deal cards (shoe handles this)
    - Know about game rules (just counts cards)
"""

from dataclasses import dataclass, field
from typing import List

from ..game.deck import Card, DECK_SIZE
from .hilo import get_hilo_value


@dataclass
class Counter:
    """
    Hi-Lo card counter.
    
    This class maintains the running count and calculates the true count.
    It should be updated via count_card() every time a card is exposed.
    
    Attributes:
        running_count: Current running count (sum of Hi-Lo values).
        cards_seen: Number of cards that have been counted.
        cards_seen_list: List of cards seen (for debugging/verification).
    """
    running_count: int = 0
    cards_seen: int = 0
    _cards_seen_list: List[Card] = field(default_factory=list, repr=False)
    
    # Configuration
    _track_cards: bool = field(default=False, repr=False)  # For debugging only
    
    def count_card(self, card: Card) -> int:
        """
        Update the count for an exposed card.
        
        Args:
            card: The card that was just exposed.
        
        Returns:
            The new running count after this card.
        """
        hilo_value = get_hilo_value(card)
        self.running_count += hilo_value
        self.cards_seen += 1
        
        if self._track_cards:
            self._cards_seen_list.append(card)
        
        return self.running_count
    
    def true_count(self, decks_remaining: float) -> float:
        """
        Calculate the true count.
        
        True Count = Running Count / Decks Remaining
        
        Args:
            decks_remaining: Number of decks remaining in the shoe.
                             For single deck, this is cards_remaining / 52.
        
        Returns:
            The true count (can be fractional).
        
        Note:
            When decks_remaining is very small, true count becomes
            very volatile. Returns 0 if decks_remaining <= 0.
        """
        if decks_remaining <= 0:
            return 0.0
        return self.running_count / decks_remaining
    
    def true_count_int(self, decks_remaining: float) -> int:
        """
        Calculate the true count, truncated to integer.
        
        Many index plays use integer true counts. This truncates
        toward zero (e.g., +2.7 becomes +2, -2.7 becomes -2).
        
        Args:
            decks_remaining: Number of decks remaining.
        
        Returns:
            The true count as an integer.
        """
        return int(self.true_count(decks_remaining))
    
    @property
    def decks_seen(self) -> float:
        """Number of decks worth of cards counted."""
        return self.cards_seen / DECK_SIZE
    
    def cards_remaining(self, total_cards: int = DECK_SIZE) -> int:
        """
        Calculate cards remaining in the shoe.
        
        Args:
            total_cards: Total cards in the shoe (52 for single deck).
        
        Returns:
            Estimated cards remaining.
        """
        return total_cards - self.cards_seen
    
    def decks_remaining(self, total_cards: int = DECK_SIZE) -> float:
        """
        Calculate decks remaining.
        
        Args:
            total_cards: Total cards in the shoe.
        
        Returns:
            Decks remaining as a fraction.
        """
        return self.cards_remaining(total_cards) / DECK_SIZE
    
    def reset(self) -> None:
        """Reset the count (call after shuffle)."""
        self.running_count = 0
        self.cards_seen = 0
        self._cards_seen_list.clear()
    
    def verify_count(self) -> bool:
        """
        Verify the running count by recounting all tracked cards.
        
        Only works if _track_cards is True.
        
        Returns:
            True if count matches, False if there's a discrepancy.
        """
        if not self._track_cards:
            return True  # Can't verify without tracking
        
        expected = sum(get_hilo_value(c) for c in self._cards_seen_list)
        return expected == self.running_count
    
    def __str__(self) -> str:
        return f"RC: {self.running_count:+d} ({self.cards_seen} cards seen)"
    
    def detailed_str(self, decks_remaining: float) -> str:
        """Detailed string with true count."""
        tc = self.true_count(decks_remaining)
        return (
            f"RC: {self.running_count:+d} | "
            f"TC: {tc:+.1f} | "
            f"{self.cards_seen} cards seen"
        )

"""
shoe.py - Dealing shoe management for single-deck blackjack.

PURPOSE:
    Manages the card shoe (shuffled deck), dealing, and penetration tracking.
    For this trainer, we use exactly ONE deck.

RESPONSIBILITIES:
    - Shuffle the deck
    - Deal cards one at a time
    - Track cards remaining and penetration
    - Signal when reshuffle is needed
    - Provide burn card functionality

MUST NOT:
    - Track the count (Counter handles this)
    - Know about hands or game rules (Engine handles this)
    - Support multiple decks (single-deck ONLY)
"""

import random
from typing import List, Optional
from dataclasses import dataclass, field

from .deck import Card, create_deck, DECK_SIZE


@dataclass
class Shoe:
    """
    Single-deck shoe with shuffle and penetration tracking.
    
    Attributes:
        penetration: Fraction of deck to deal before reshuffling (0.0 to 1.0).
                     Default 0.65 means deal 65% of cards before reshuffle.
        _cards: Internal list of remaining cards (top of deck is end of list).
        _dealt_count: Number of cards dealt since last shuffle.
    """
    penetration: float = 0.65
    _cards: List[Card] = field(default_factory=list, repr=False)
    _dealt_count: int = field(default=0, repr=False)
    
    def __post_init__(self) -> None:
        """Initialize with a fresh shuffled deck."""
        if not self._cards:
            self.shuffle()
    
    def shuffle(self) -> None:
        """
        Create a fresh deck and shuffle it.
        
        This resets the shoe completely:
        - New 52-card deck
        - Random shuffle
        - Reset dealt count
        """
        self._cards = create_deck()
        random.shuffle(self._cards)
        self._dealt_count = 0
    
    def deal(self) -> Card:
        """
        Deal one card from the shoe.
        
        Returns:
            The top card from the shoe.
        
        Raises:
            IndexError: If the shoe is empty (should not happen in normal play
                        because needs_shuffle should be checked first).
        """
        if not self._cards:
            raise IndexError("Shoe is empty. Call shuffle() first.")
        
        card = self._cards.pop()
        self._dealt_count += 1
        return card
    
    def burn(self, count: int = 1) -> List[Card]:
        """
        Burn (discard) cards from the top of the shoe.
        
        Standard practice is to burn one card after shuffle.
        Burned cards should still be counted if visible.
        
        Args:
            count: Number of cards to burn.
        
        Returns:
            List of burned cards (so they can be counted if visible).
        """
        burned = []
        for _ in range(count):
            if self._cards:
                burned.append(self.deal())
        return burned
    
    @property
    def cards_remaining(self) -> int:
        """Number of cards remaining in the shoe."""
        return len(self._cards)
    
    @property
    def cards_dealt(self) -> int:
        """Number of cards dealt since last shuffle."""
        return self._dealt_count
    
    @property
    def decks_remaining(self) -> float:
        """
        Fraction of decks remaining (for true count calculation).
        
        For single deck:
            - 52 cards remaining = 1.0 decks
            - 26 cards remaining = 0.5 decks
            - 13 cards remaining = 0.25 decks
        """
        return self.cards_remaining / DECK_SIZE
    
    @property
    def penetration_reached(self) -> float:
        """Current penetration as a fraction (0.0 to 1.0)."""
        return self._dealt_count / DECK_SIZE
    
    @property
    def needs_shuffle(self) -> bool:
        """
        Returns True if penetration has been reached and reshuffle is needed.
        
        This should be checked BEFORE starting a new hand, not mid-hand.
        """
        return self.penetration_reached >= self.penetration
    
    def peek(self, count: int = 1) -> List[Card]:
        """
        Peek at the top card(s) without dealing them.
        
        This is a DEBUG/TESTING method and should NOT be used during
        normal training (defeats the purpose of counting practice).
        
        Args:
            count: Number of cards to peek at.
        
        Returns:
            List of cards from the top of the shoe.
        """
        return self._cards[-count:] if count <= len(self._cards) else self._cards[:]
    
    def __len__(self) -> int:
        """Returns the number of cards remaining."""
        return self.cards_remaining
    
    def __str__(self) -> str:
        return (
            f"Shoe({self.cards_remaining} cards remaining, "
            f"{self.penetration_reached:.1%} dealt, "
            f"reshuffle at {self.penetration:.0%})"
        )

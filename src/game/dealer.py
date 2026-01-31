"""
dealer.py - Dealer representation and logic for blackjack.

PURPOSE:
    Implements dealer behavior according to casino rules.
    Critical: The hole card is NOT exposed (and thus NOT counted) until
    the dealer's turn to play.

RESPONSIBILITIES:
    - Hold dealer's hand
    - Expose only the upcard during player's turn
    - Play according to H17/S17 rules
    - Check for blackjack

MUST NOT:
    - Count cards (counter module handles this)
    - Decide when to reveal hole card (engine handles timing)
    - Track money (dealer doesn't have a bankroll)
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

from .hand import Hand, HandStatus
from .deck import Card


class DealerRule(Enum):
    """
    Dealer soft 17 rule.
    
    H17: Dealer hits on soft 17 (more common in single-deck)
    S17: Dealer stands on soft 17
    
    H17 is worse for the player (house edge ~0.2% higher).
    """
    H17 = "h17"  # Hit soft 17
    S17 = "s17"  # Stand soft 17


@dataclass
class Dealer:
    """
    Represents the casino dealer.
    
    The dealer follows fixed rules with no decision-making.
    Key behavior:
    - Always hits on hard 16 or less
    - H17: Hits on soft 17, stands on hard 17+
    - S17: Stands on any 17+
    
    Attributes:
        hand: The dealer's current hand.
        rule: Whether dealer hits or stands on soft 17.
        hole_card_revealed: Whether the hole card has been shown.
    """
    hand: Hand = field(default_factory=Hand)
    rule: DealerRule = DealerRule.H17  # Default: hit soft 17
    hole_card_revealed: bool = False
    
    def new_hand(self) -> Hand:
        """
        Start a new round with a fresh hand.
        
        Returns:
            The newly created Hand object.
        """
        self.hand = Hand()
        self.hole_card_revealed = False
        return self.hand
    
    def receive_card(self, card: Card, face_up: bool = True) -> None:
        """
        Add a card to the dealer's hand.
        
        Args:
            card: The card to add.
            face_up: Whether this card is face-up (visible to player).
                     The second card (hole card) is typically face-down.
        """
        self.hand.add_card(card)
        
        # If this is the second card and face-down, it's the hole card
        # The hole_card_revealed flag stays False until reveal_hole_card()
    
    @property
    def upcard(self) -> Optional[Card]:
        """
        Returns the dealer's visible upcard.
        
        This is always the first card dealt to the dealer.
        The upcard is critical for basic strategy decisions.
        """
        return self.hand.upcard
    
    @property
    def hole_card(self) -> Optional[Card]:
        """
        Returns the dealer's hole card (second card).
        
        WARNING: In training mode, this should only be accessed
        after hole_card_revealed is True. Accessing it early
        would defeat the purpose of count training.
        """
        return self.hand.hole_card
    
    def reveal_hole_card(self) -> Optional[Card]:
        """
        Reveal the hole card.
        
        Called when it's time for the dealer to play or show blackjack.
        This is when the counter should register the hole card.
        
        Returns:
            The hole card, or None if not present.
        """
        self.hole_card_revealed = True
        return self.hole_card
    
    @property
    def showing(self) -> str:
        """
        Returns string representation of what the dealer is showing.
        
        During player's turn: "K♠ [?]"
        After reveal: "K♠ 7♥"
        """
        if not self.hand.cards:
            return "(no cards)"
        
        upcard_str = str(self.upcard) if self.upcard else "?"
        
        if len(self.hand.cards) == 1:
            return upcard_str
        
        if self.hole_card_revealed:
            # Show all cards
            return " ".join(str(c) for c in self.hand.cards)
        else:
            # Show upcard and hidden hole card
            return f"{upcard_str} [?]"
    
    @property
    def has_blackjack(self) -> bool:
        """
        Check if dealer has a natural blackjack.
        
        This should only be checked after hole card is revealed,
        or when checking for insurance/even money situations.
        """
        return self.hand.is_blackjack
    
    def should_hit(self) -> bool:
        """
        Determine if dealer should hit according to house rules.
        
        Rules:
        - Always hit on 16 or less
        - H17: Hit on soft 17
        - S17: Stand on any 17+
        
        Returns:
            True if dealer must hit, False if dealer must stand.
        """
        value, is_soft = self.hand.soft_value
        
        if value < 17:
            return True
        
        if value == 17 and is_soft:
            # Soft 17: depends on house rule
            return self.rule == DealerRule.H17
        
        # Hard 17+ or soft 18+: always stand
        return False
    
    def play(self, deal_card_callback) -> None:
        """
        Execute dealer's complete turn.
        
        Dealer reveals hole card and hits until should_hit() returns False.
        
        Args:
            deal_card_callback: Function that returns a Card when called.
                                Called each time dealer needs to hit.
        """
        # Ensure hole card is revealed first
        if not self.hole_card_revealed:
            self.reveal_hole_card()
        
        # Hit until standing
        while self.should_hit() and not self.hand.is_busted:
            card = deal_card_callback()
            self.receive_card(card)
        
        # Mark hand as stood if not busted
        if not self.hand.is_busted:
            self.hand.status = HandStatus.STOOD
        else:
            self.hand.status = HandStatus.BUSTED
    
    @property
    def final_value(self) -> int:
        """Returns the dealer's final hand value."""
        return self.hand.value
    
    @property
    def is_busted(self) -> bool:
        """Returns True if dealer busted."""
        return self.hand.is_busted
    
    @property
    def upcard_value(self) -> int:
        """
        Returns the point value of the upcard.
        
        Useful for strategy lookups where you need the numeric value.
        Ace returns 11 here.
        """
        return self.upcard.value if self.upcard else 0
    
    @property
    def upcard_is_ace(self) -> bool:
        """Returns True if upcard is an Ace (insurance situation)."""
        return self.upcard.is_ace if self.upcard else False
    
    @property
    def upcard_is_ten(self) -> bool:
        """Returns True if upcard is a 10-value card."""
        return self.upcard.is_ten_value if self.upcard else False
    
    def __str__(self) -> str:
        return f"Dealer({self.showing}) value={self.hand.value if self.hole_card_revealed else '?'}"

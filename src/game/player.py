"""
player.py - Player representation for blackjack training.

PURPOSE:
    Manages player state including bankroll, bets, and hand ownership.
    Supports split hands (up to 4 hands from 3 splits).

RESPONSIBILITIES:
    - Track bankroll and betting
    - Manage multiple hands (from splits)
    - Handle bet placement and payouts

MUST NOT:
    - Make strategy decisions (strategy module handles this)
    - Deal cards (engine handles this)
    - Calculate hand values (hand module handles this)
"""

from dataclasses import dataclass, field
from typing import List, Optional

from .hand import Hand, HandStatus


@dataclass
class Player:
    """
    Represents the player in a blackjack game.
    
    For training purposes, bankroll tracking is optional but useful
    for understanding the variance and expected value of decisions.
    
    Attributes:
        bankroll: Current money available, starts at 1000 by default.
        hands: List of active hands (usually 1, up to 4 if splitting).
        base_bet: Default bet size for each hand.
        max_splits: Maximum number of splits allowed.
    """
    bankroll: float = 1000.0
    hands: List[Hand] = field(default_factory=list)
    base_bet: float = 10.0
    max_splits: int = 3  # Allows up to 4 total hands
    
    _split_count: int = field(default=0, repr=False)
    
    def new_hand(self, bet: Optional[float] = None) -> Hand:
        """
        Create a new hand for a new round.
        
        Clears any existing hands and creates a fresh hand with the bet.
        
        Args:
            bet: Amount to bet. If None, uses base_bet.
        
        Returns:
            The newly created Hand object.
        
        Raises:
            ValueError: If bet exceeds bankroll.
        """
        bet_amount = bet if bet is not None else self.base_bet
        
        if bet_amount > self.bankroll:
            raise ValueError(f"Bet {bet_amount} exceeds bankroll {self.bankroll}")
        
        # Clear previous hands
        self.hands.clear()
        self._split_count = 0
        
        # Create new hand
        hand = Hand(bet=bet_amount)
        self.hands.append(hand)
        
        # Deduct bet from bankroll
        self.bankroll -= bet_amount
        
        return hand
    
    def split_hand(self, hand_index: int = 0) -> tuple[Hand, Hand]:
        """
        Split a hand into two hands.
        
        Creates two new hands from a pair, each with the same bet.
        The additional bet is deducted from the bankroll.
        
        Args:
            hand_index: Index of the hand to split (default 0).
        
        Returns:
            Tuple of the two new Hand objects.
        
        Raises:
            ValueError: If split is not allowed or exceeds max splits.
            ValueError: If insufficient bankroll for split bet.
        """
        if self._split_count >= self.max_splits:
            raise ValueError(f"Maximum splits ({self.max_splits}) reached")
        
        hand = self.hands[hand_index]
        
        if not hand.can_split:
            raise ValueError("Hand cannot be split (not a pair)")
        
        if hand.bet > self.bankroll:
            raise ValueError(f"Insufficient bankroll for split bet")
        
        # Deduct additional bet for second hand
        self.bankroll -= hand.bet
        
        # Split the hand
        hand1, hand2 = hand.split()
        
        # Replace original hand with split hands
        self.hands[hand_index] = hand1
        self.hands.insert(hand_index + 1, hand2)
        
        self._split_count += 1
        
        return hand1, hand2
    
    def double_down(self, hand_index: int = 0) -> None:
        """
        Double down on a hand.
        
        Doubles the bet and marks the hand for exactly one more card.
        
        Args:
            hand_index: Index of the hand to double.
        
        Raises:
            ValueError: If double is not allowed.
            ValueError: If insufficient bankroll.
        """
        hand = self.hands[hand_index]
        
        if not hand.can_double:
            raise ValueError("Cannot double: not first two cards or already acted")
        
        if hand.bet > self.bankroll:
            raise ValueError("Insufficient bankroll to double")
        
        # Deduct additional bet
        self.bankroll -= hand.bet
        
        # Double the bet and mark the hand
        hand.bet *= 2
        hand.double_down()
    
    def surrender_hand(self, hand_index: int = 0) -> float:
        """
        Surrender a hand (late surrender).
        
        Returns half the bet to the bankroll and marks hand as surrendered.
        
        Args:
            hand_index: Index of the hand to surrender.
        
        Returns:
            Amount returned to bankroll.
        
        Raises:
            ValueError: If surrender is not allowed.
        """
        hand = self.hands[hand_index]
        
        if not hand.can_surrender:
            raise ValueError("Cannot surrender: only allowed on first two cards")
        
        # Return half the bet
        refund = hand.bet / 2
        self.bankroll += refund
        
        hand.surrender()
        
        return refund
    
    def receive_payout(self, amount: float) -> None:
        """
        Add winnings to bankroll.
        
        Args:
            amount: Amount won (including original bet if applicable).
        """
        self.bankroll += amount
    
    @property
    def active_hand(self) -> Optional[Hand]:
        """
        Returns the first active hand, or None if no hands are active.
        
        Used during play to determine which hand the player is acting on.
        """
        for hand in self.hands:
            if hand.status == HandStatus.ACTIVE:
                return hand
        return None
    
    @property
    def active_hand_index(self) -> Optional[int]:
        """Returns the index of the active hand, or None if no active hands."""
        for i, hand in enumerate(self.hands):
            if hand.status == HandStatus.ACTIVE:
                return i
        return None
    
    @property
    def all_hands_complete(self) -> bool:
        """Returns True if all hands have finished playing."""
        return all(
            hand.status != HandStatus.ACTIVE 
            for hand in self.hands
        )
    
    @property
    def total_bet(self) -> float:
        """Total amount bet across all hands this round."""
        return sum(hand.bet for hand in self.hands)
    
    @property
    def can_split(self) -> bool:
        """Returns True if player can still split (hasn't reached max)."""
        return self._split_count < self.max_splits
    
    def reset_for_round(self) -> None:
        """Clear hands for a new round (bankroll is preserved)."""
        self.hands.clear()
        self._split_count = 0
    
    def __str__(self) -> str:
        hands_str = ", ".join(str(h) for h in self.hands)
        return f"Player(bankroll=${self.bankroll:.2f}, hands=[{hands_str}])"
